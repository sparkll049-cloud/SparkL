# viewer.py
"""
Serves protected past-question content.
Pages are pre-rendered at upload time and stored in Backblaze.
For questions uploaded before the pre-render system existed, falls back
to rendering from the original PDF on demand (and stores the result so
it never renders twice).
"""
from __future__ import annotations

import io
import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.supabase_client import supabase
from app.storage import download_bytes, get_signed_url, list_keys_with_prefix, upload_bytes

router = APIRouter(prefix="/api/questions", tags=["Viewer"])

SIGNED_URL_TTL  = 300
FREE_PAGE_LIMIT = 2
TILE_GRID       = 3
# Fallback render quality — lower than upload-time render to save memory
FALLBACK_SCALE   = 100 / 72   # ~100 DPI
FALLBACK_QUALITY = 75
MAX_IMG_WIDTH    = 1200

B2_BUCKET = os.getenv("B2_BUCKET_NAME", "sparkl-questions")

_IMG_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}


# ── Auth ──────────────────────────────────────────────────────────────────────

async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user = getattr(user_response, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    profile = (
        supabase.table("profiles")
        .select("is_admin, admin_role")
        .eq("id", user.id)
        .single()
        .execute()
    )
    is_admin = False
    if profile and profile.data:
        is_admin = bool(
            profile.data.get("is_admin") or profile.data.get("admin_role")
        )

    return {
        "id": UUID(user.id),
        "is_admin": is_admin,
        "email": user.email or str(user.id),
    }


# ── Key helpers ───────────────────────────────────────────────────────────────

def _to_key(file_url: str) -> str:
    """
    Normalise file_url to a plain B2 key.
    Old uploads stored the full URL; new ones store just the key.
    """
    if not file_url or not file_url.startswith("http"):
        return file_url
    marker = f"/file/{B2_BUCKET}/"
    idx = file_url.find(marker)
    if idx != -1:
        return file_url[idx + len(marker):]
    parts = file_url.split(f"/{B2_BUCKET}/", 1)
    if len(parts) == 2:
        return parts[1]
    return file_url


def _page_key(question_id: str, page_number: int) -> str:
    return f"page-images/{question_id}/page-{page_number}.jpg"


# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_question_record(question_id: str) -> dict:
    res = (
        supabase.table("past_questions")
        .select("id, file_url, mime_type, status, page_count")
        .eq("id", question_id)
        .single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return res.data


def _get_subscription(user_id: str) -> dict:
    res = (
        supabase.table("subscriptions")
        .select("status")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if res and res.data:
        return {"is_paid": res.data[0].get("status") == "active"}
    return {"is_paid": False}


# ── Page count (lazy fill for rows where page_count is NULL) ─────────────────

def _count_pages(file_bytes: bytes, mime_type: str) -> int:
    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(file_bytes)
            try:
                return max(1, len(pdf))
            finally:
                pdf.close()
        except Exception:
            try:
                from pypdf import PdfReader
                return max(1, len(PdfReader(io.BytesIO(file_bytes)).pages))
            except Exception:
                return 1
    return 1


def _save_page_count(question_id: str, total: int) -> None:
    try:
        supabase.table("past_questions").update(
            {"page_count": total}
        ).eq("id", question_id).execute()
    except Exception:
        pass  # non-critical — it will be recomputed next time


def _ensure_page_count(record: dict) -> int:
    """Return page_count, computing and saving it if the row has none yet."""
    existing = record.get("page_count")
    if existing:
        return int(existing)

    file_bytes = download_bytes(_to_key(record["file_url"]))
    total = _count_pages(file_bytes, record.get("mime_type") or "application/pdf")
    _save_page_count(record["id"], total)
    return total


# ── Watermark ─────────────────────────────────────────────────────────────────

def _add_watermark(img, text: str):
    from PIL import Image, ImageDraw
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw    = ImageDraw.Draw(overlay)
    for y in range(-img.height, img.height * 2, 160):
        for x in range(-img.width, img.width * 2, 320):
            draw.text((x, y), text, fill=(140, 140, 140, 55))
    watermarked = Image.alpha_composite(img.convert("RGBA"), overlay)
    return watermarked.convert("RGB")


# ── Fallback: render one page from the original file ─────────────────────────

def _render_page_to_jpeg(file_bytes: bytes, mime_type: str, page_number: int) -> bytes:
    """
    Render a single page from the original PDF/image to JPEG bytes.
    Used only when the pre-rendered JPEG is missing (old uploads).
    Low DPI + capped width to keep memory use small.
    """
    from PIL import Image

    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
        except ImportError:
            raise HTTPException(status_code=500, detail="pypdfium2 not installed.")

        pdf = pdfium.PdfDocument(file_bytes)
        if page_number > len(pdf):
            pdf.close()
            raise HTTPException(status_code=404, detail=f"Page {page_number} does not exist.")

        bitmap  = pdf[page_number - 1].render(scale=FALLBACK_SCALE)
        pil_img = bitmap.to_pil().convert("RGB")
        # Free the pdf object immediately — don't hold all pages in memory
        pdf.close()
    else:
        pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    # Cap width to limit memory and storage
    if pil_img.width > MAX_IMG_WIDTH:
        ratio   = MAX_IMG_WIDTH / pil_img.width
        pil_img = pil_img.resize(
            (MAX_IMG_WIDTH, int(pil_img.height * ratio)),
            Image.LANCZOS,
        )

    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=FALLBACK_QUALITY, optimize=True)
    return buf.getvalue()


def _fetch_rendered_page(
    question_id: str,
    page_number: int,
    file_url: str,
    mime_type: str,
) -> bytes:
    """
    Return JPEG bytes for a page.
    1. Try pre-rendered image from Backblaze (fast, zero rendering).
    2. If missing (old upload), render from original PDF, then store the
       result so this path is never hit again for the same page.
    """
    key = _page_key(question_id, page_number)

    try:
        return download_bytes(key)
    except HTTPException:
        pass  # pre-rendered image not found — fall through to render

    # Download original and render just this one page
    original_bytes = download_bytes(_to_key(file_url))
    jpeg_bytes     = _render_page_to_jpeg(original_bytes, mime_type, page_number)

    # Store it so future requests skip rendering entirely
    try:
        upload_bytes(jpeg_bytes, key, "image/jpeg")
    except Exception:
        pass  # non-critical — serve the bytes anyway

    return jpeg_bytes


def _fetch_and_watermark_page(
    question_id: str,
    page_number: int,
    user_email: str,
    file_url: str,
    mime_type: str,
) -> bytes:
    from PIL import Image

    raw_bytes = _fetch_rendered_page(question_id, page_number, file_url, mime_type)

    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    img = _add_watermark(img, f"SparkL · {user_email}")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()


# ── Core page getter (auth + gating) ─────────────────────────────────────────

async def _get_page_jpeg(
    question_id: str,
    page_number: int,
    user: dict,
) -> bytes:
    if page_number < 1:
        raise HTTPException(status_code=400, detail="Page number must be 1 or greater.")

    record = await run_in_threadpool(_get_question_record, question_id)

    if not user["is_admin"] and record["status"] != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    if not user["is_admin"]:
        sub = await run_in_threadpool(_get_subscription, str(user["id"]))
        if not sub["is_paid"] and page_number > FREE_PAGE_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free accounts can view the first {FREE_PAGE_LIMIT} pages only.",
            )

    return await run_in_threadpool(
        _fetch_and_watermark_page,
        question_id,
        page_number,
        user["email"],
        record["file_url"],
        record["mime_type"],
    )


def _crop_tile(jpeg_bytes: bytes, row: int, col: int) -> bytes:
    from PIL import Image
    img            = Image.open(io.BytesIO(jpeg_bytes))
    w, h           = img.size
    left           = (col * w) // TILE_GRID
    right          = ((col + 1) * w) // TILE_GRID
    top            = (row * h) // TILE_GRID
    bottom         = ((row + 1) * h) // TILE_GRID
    tile           = img.crop((left, top, right, bottom))
    out            = io.BytesIO()
    tile.save(out, format="JPEG", quality=82, optimize=True)
    return out.getvalue()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{question_id}/page/{page_number}", response_class=Response)
async def get_page_image(
    question_id: str,
    page_number: int,
    user: dict = Depends(get_current_user),
):
    jpeg_bytes = await _get_page_jpeg(question_id, page_number, user)
    return Response(content=jpeg_bytes, media_type="image/jpeg", headers=_IMG_HEADERS)


@router.get("/{question_id}/page/{page_number}/tile/{row}/{col}", response_class=Response)
async def get_page_tile(
    question_id: str,
    page_number: int,
    row: int,
    col: int,
    user: dict = Depends(get_current_user),
):
    jpeg_bytes = await _get_page_jpeg(question_id, page_number, user)
    tile_bytes = await run_in_threadpool(_crop_tile, jpeg_bytes, row, col)
    return Response(content=tile_bytes, media_type="image/jpeg", headers=_IMG_HEADERS)


@router.get("/{question_id}/page-count")
async def get_page_count(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    record = await run_in_threadpool(_get_question_record, question_id)

    if not user["is_admin"] and record["status"] != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    total = await run_in_threadpool(_ensure_page_count, record)

    sub = {"is_paid": True} if user["is_admin"] else await run_in_threadpool(
        _get_subscription, str(user["id"])
    )

    return {
        "total_pages": total,
        "viewable_pages": total if sub["is_paid"] else min(total, FREE_PAGE_LIMIT),
        "is_paid": sub["is_paid"],
    }


@router.post("/{question_id}/render-pages")
async def trigger_page_render(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Admin-only: pre-render all pages for a question uploaded before the
    render-on-upload system was deployed. Safe to call multiple times —
    page_renderer skips pages that already exist.
    """
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin only.")

    from app.services.page_renderer import render_and_store_pages

    record = await run_in_threadpool(_get_question_record, question_id)
    file_bytes = await run_in_threadpool(download_bytes, _to_key(record["file_url"]))
    total = await run_in_threadpool(
        render_and_store_pages,
        question_id,
        file_bytes,
        record["mime_type"],
    )
    if isinstance(total, int) and total > 0:
        await run_in_threadpool(_save_page_count, question_id, total)
    return {"rendered": True, "pages": total}


@router.get("/{question_id}/admin-url")
async def get_admin_signed_url(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required.")
    record     = await run_in_threadpool(_get_question_record, question_id)
    signed_url = await run_in_threadpool(
        get_signed_url, _to_key(record["file_url"]), SIGNED_URL_TTL
    )
    return {"url": signed_url, "expires_in": SIGNED_URL_TTL, "warning": "Admin only."}
