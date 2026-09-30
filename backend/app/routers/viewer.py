# viewer.py
"""
Serves protected past-question content.
Pages are pre-rendered at upload time and stored in Backblaze.
This router only fetches + watermarks stored JPEGs — no PDF rendering.
"""
from __future__ import annotations

import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.supabase_client import supabase
from app.storage import download_bytes, get_signed_url, list_keys_with_prefix

router = APIRouter(prefix="/api/questions", tags=["Viewer"])

SIGNED_URL_TTL = 300
FREE_PAGE_LIMIT = 2
TILE_GRID = 3

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


# ── Watermark ─────────────────────────────────────────────────────────────────

def _add_watermark(img, text: str):
    from PIL import Image, ImageDraw
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(-img.height, img.height * 2, 160):
        for x in range(-img.width, img.width * 2, 320):
            draw.text((x, y), text, fill=(140, 140, 140, 55))
    watermarked = Image.alpha_composite(img.convert("RGBA"), overlay)
    return watermarked.convert("RGB")


# ── Core: fetch stored page and watermark ─────────────────────────────────────

def _get_page_key(question_id: str, page_number: int) -> str:
    return f"page-images/{question_id}/page-{page_number}.jpg"


def _fetch_and_watermark_page(
    question_id: str,
    page_number: int,
    user_email: str,
) -> bytes:
    """
    Download the pre-rendered page JPEG from Backblaze,
    burn in the watermark, return JPEG bytes.
    No PDF rendering — just image processing.
    """
    from PIL import Image

    key = _get_page_key(question_id, page_number)
    raw_bytes = download_bytes(key)

    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    img = _add_watermark(img, f"SparkL · {user_email}")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()


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

    jpeg_bytes = await run_in_threadpool(
        _fetch_and_watermark_page,
        question_id,
        page_number,
        user["email"],
    )
    return jpeg_bytes


def _crop_tile(jpeg_bytes: bytes, row: int, col: int) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(jpeg_bytes))
    w, h = img.size
    left   = (col * w) // TILE_GRID
    right  = ((col + 1) * w) // TILE_GRID
    top    = (row * h) // TILE_GRID
    bottom = ((row + 1) * h) // TILE_GRID
    tile = img.crop((left, top, right, bottom))
    out = io.BytesIO()
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

    total = int(record.get("page_count") or 1)

    sub = {"is_paid": True} if user["is_admin"] else await run_in_threadpool(
        _get_subscription, str(user["id"])
    )

    return {
        "total_pages": total,
        "viewable_pages": total if sub["is_paid"] else min(total, FREE_PAGE_LIMIT),
        "is_paid": sub["is_paid"],
    }


@router.get("/{question_id}/admin-url")
async def get_admin_signed_url(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required.")
    record = await run_in_threadpool(_get_question_record, question_id)
    signed_url = await run_in_threadpool(get_signed_url, record["file_url"], SIGNED_URL_TTL)
    return {"url": signed_url, "expires_in": SIGNED_URL_TTL, "warning": "Admin only."}