from __future__ import annotations

import io
import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from fastapi.concurrency import run_in_threadpool

from app.auth import get_current_user  # ← adjust to your student auth dependency
from app.storage import download_bytes
from app.supabase_client import supabase

try:
    from pdf2image import convert_from_bytes
    _PDF2IMAGE_OK = True
except ImportError:
    _PDF2IMAGE_OK = False

try:
    from PIL import Image, ImageDraw, ImageFont
    _PILLOW_OK = True
except ImportError:
    _PILLOW_OK = False

router = APIRouter(prefix="/api/viewer", tags=["viewer"])

FREE_PAGE_LIMIT = 2
RENDER_DPI = 110  # lighter than admin (150) to stay within Render free-tier memory


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_uuid(value: str) -> None:
    try:
        UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid question id.") from exc


def _user_id(user) -> str:
    """Works whether get_current_user returns an id string, a dict, or an object."""
    if isinstance(user, str):
        return user
    if isinstance(user, dict):
        return str(user.get("id") or user.get("sub"))
    return str(getattr(user, "id", user))


def _is_paid(user_id: str) -> bool:
    """
    ADAPT THIS to however your /api/payments/subscription/status decides is_paid.
    Example below assumes a `subscriptions` table with user_id, status, expires_at.
    """
    try:
        res = (
            supabase.table("subscriptions")
            .select("status, expires_at")
            .eq("user_id", user_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return False
        exp = rows[0].get("expires_at")
        if exp:
            expires = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            return expires > datetime.now(timezone.utc)
        return True
    except Exception:
        return False


def _get_paper(question_id: str) -> dict:
    res = (
        supabase.table("past_questions")
        .select("id, file_url, mime_type, status")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    row = res.data if res else None
    if not row or not row.get("file_url") or row.get("status") != "approved":
        raise HTTPException(status_code=404, detail="Paper not found.")
    return row


def _get_font(size: int):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _watermark(img: "Image.Image", user_id: str) -> "Image.Image":
    img = img.convert("RGBA")
    w, h = img.size
    font = _get_font(max(16, w // 40))
    text = f"SPARKL · {user_id[:8]}"
    color = (99, 102, 241, 28)

    diag = int(math.hypot(w, h))
    canvas = Image.new("RGBA", (diag * 2, diag * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = (bbox[2] - bbox[0]) + 56
    th = (bbox[3] - bbox[1]) + 56
    cw, ch = canvas.size
    for row in range(-2, (ch // th) + 3):
        for col in range(-2, (cw // tw) + 3):
            x = col * tw + (row % 2) * (tw // 2)
            draw.text((x, row * th), text, font=font, fill=color)
    canvas = canvas.rotate(-26, resample=Image.BICUBIC)
    ox = (canvas.width - w) // 2
    oy = (canvas.height - h) // 2
    img = Image.alpha_composite(img, canvas.crop((ox, oy, ox + w, oy + h)))
    return img.convert("RGB")


def _page_count_sync(file_bytes: bytes, mime_type: str) -> int:
    if mime_type == "application/pdf":
        from pypdf import PdfReader
        try:
            return len(PdfReader(io.BytesIO(file_bytes)).pages)
        except Exception:
            return 1
    return 1


def _render_page_sync(
    file_bytes: bytes, mime_type: str, page_num: int, user_id: str
) -> bytes:
    if mime_type == "application/pdf":
        if not _PDF2IMAGE_OK:
            raise HTTPException(status_code=500, detail="Page rendering unavailable.")
        pages = convert_from_bytes(
            file_bytes, dpi=RENDER_DPI, first_page=page_num, last_page=page_num, fmt="jpeg"
        )
        if not pages:
            raise HTTPException(status_code=404, detail=f"Page {page_num} does not exist.")
        img = pages[0]
    else:
        if page_num != 1:
            raise HTTPException(status_code=404, detail=f"Page {page_num} does not exist.")
        img = Image.open(io.BytesIO(file_bytes))

    if _PILLOW_OK:
        img = _watermark(img, user_id)
    out = io.BytesIO()
    img.convert("RGB").save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{question_id}/page-count")
async def page_count(question_id: str, user=Depends(get_current_user)):
    _check_uuid(question_id)
    row = _get_paper(question_id)
    file_bytes = await run_in_threadpool(download_bytes, row["file_url"])
    count = await run_in_threadpool(
        _page_count_sync, file_bytes, row.get("mime_type") or "application/pdf"
    )
    return {"page_count": count, "free_page_limit": FREE_PAGE_LIMIT}


@router.get("/{question_id}/page/{page_num}")
async def get_page(
    question_id: str,
    page_num: int = Path(..., ge=1, le=500),
    user=Depends(get_current_user),
):
    _check_uuid(question_id)
    uid = _user_id(user)
    row = _get_paper(question_id)

    if page_num > FREE_PAGE_LIMIT:
        paid = await run_in_threadpool(_is_paid, uid)
        if not paid:
            raise HTTPException(
                status_code=403,
                detail="Upgrade your plan to read the full paper.",
            )

    file_bytes = await run_in_threadpool(download_bytes, row["file_url"])
    jpeg = await run_in_threadpool(
        _render_page_sync,
        file_bytes,
        row.get("mime_type") or "application/pdf",
        page_num,
        uid,
    )
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
            "Expires": "0",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
        },
    )