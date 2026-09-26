"""
routers/viewer.py  (cache-enabled version)
------------------------------------------
Every expensive operation is now cached via app.viewer_cache:

  Request 1 (cold):
    Supabase question fetch   →  cached 10 min
    Supabase profile fetch    →  cached 1 h
    B2 download               →  rendered page cached 24 h
    pdf2image render          →  result cached 24 h
    Pillow watermark          →  always applied fresh (per-user footer)

  Request 2+ (warm):
    No Supabase calls
    No B2 download
    No pdf2image / Pillow render
    ↳ Only watermark is re-applied (fast, in-process, ~10 ms)

Cache invalidation:
    Call invalidate_question_pages(question_id) and
    invalidate_question_meta(question_id) from your admin router
    whenever a question is updated, re-uploaded, or deleted.
"""

from __future__ import annotations

import io
import math
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import Response

from app.auth import get_current_user
from app.supabase_client import supabase
from app.storage import _client
from app.services.subscription import get_user_limits
from app.viewer_cache import (
    get_base_page,     set_base_page,
    get_question_meta, set_question_meta,
    get_uploader_name, set_uploader_name,
    get_page_count,    set_page_count,
    cache_stats,
)

try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_OK = True
except ImportError:
    PDF2IMAGE_OK = False

try:
    from PIL import Image, ImageDraw, ImageFont
    PILLOW_OK = True
except ImportError:
    PILLOW_OK = False

router = APIRouter(prefix="/api/viewer", tags=["viewer"])

B2_BUCKET       = os.getenv("B2_BUCKET_NAME", "sparkl-questions")
FREE_PAGE_LIMIT = 2

# ── Storage ────────────────────────────────────────────────────────────────────

def _download_from_b2(key: str) -> bytes:
    try:
        obj = _client().get_object(Bucket=B2_BUCKET, Key=key)
        return obj["Body"].read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch file: {e}")


# ── Font helper ────────────────────────────────────────────────────────────────

def _get_font(size: int):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


# ── Watermark (per-user — never cached) ───────────────────────────────────────

def _apply_watermark(image: "Image.Image", uploader_name: str) -> "Image.Image":
    """
    Draws on top of the already-rendered base page image.
    This is the only per-user step — everything before it is cached.
    """
    img = image.convert("RGBA")
    w, h = img.size

    # ── Tiled diagonal 'SparkL' ────────────────────────────────────────
    font_size  = max(22, w // 30)
    tile_font  = _get_font(font_size)
    tile_text  = "SparkL"
    TILE_COLOR = (99, 102, 241, 28)   # indigo-500 @ ~11 % — visible on any background

    diag      = int(math.hypot(w, h))
    wm_canvas = Image.new("RGBA", (diag * 2, diag * 2), (0, 0, 0, 0))
    wm_draw   = ImageDraw.Draw(wm_canvas)

    bbox   = wm_draw.textbbox((0, 0), tile_text, font=tile_font)
    tile_w = (bbox[2] - bbox[0]) + 48
    tile_h = (bbox[3] - bbox[1]) + 48

    cw, ch = wm_canvas.size
    for row in range(-2, (ch // tile_h) + 3):
        for col in range(-2, (cw // tile_w) + 3):
            x = col * tile_w + (row % 2) * (tile_w // 2)
            y = row * tile_h
            wm_draw.text((x, y), tile_text, font=tile_font, fill=TILE_COLOR)

    wm_canvas  = wm_canvas.rotate(-26, resample=Image.BICUBIC)
    offset_x   = (wm_canvas.width  - w) // 2
    offset_y   = (wm_canvas.height - h) // 2
    wm_cropped = wm_canvas.crop((offset_x, offset_y, offset_x + w, offset_y + h))
    img        = Image.alpha_composite(img, wm_cropped)

    # ── Footer bar with uploader name ──────────────────────────────────
    bar_h       = max(34, h // 26)
    footer_font = _get_font(max(13, w // 58))
    footer_text = f"Uploaded by: {uploader_name}  ·  Property of SparkL"
    draw2       = ImageDraw.Draw(img)

    draw2.rectangle([(0, h - bar_h), (w, h)], fill=(10, 10, 20, 185))
    fb = draw2.textbbox((0, 0), footer_text, font=footer_font)
    tx = (w - (fb[2] - fb[0])) // 2
    ty = h - bar_h + (bar_h - (fb[3] - fb[1])) // 2
    draw2.text((tx, ty), footer_text, font=footer_font, fill=(255, 255, 255, 210))

    # ── Top-left brand stamp ───────────────────────────────────────────
    stamp_font = _get_font(max(11, w // 70))
    draw2.text((10, 8), "sparkl.app", font=stamp_font, fill=(99, 102, 241, 160))

    return img.convert("RGB")


# ── DB helpers (all cache-aware) ───────────────────────────────────────────────

def _fetch_question_meta(question_id: str) -> dict:
    """Load question row from cache or Supabase."""
    cached = get_question_meta(question_id)
    if cached:
        return cached

    try:
        res = (
            supabase.table("past_questions")
            .select("id, file_url, mime_type, uploaded_by, status, course_id")
            .eq("id", question_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found.")

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    if res.data["status"] != "approved":
        raise HTTPException(status_code=403, detail="This question is not yet approved.")

    set_question_meta(question_id, res.data)
    return res.data


def _fetch_uploader_name(uploaded_by: Optional[str]) -> str:
    """Load uploader display name from cache or Supabase profiles."""
    if not uploaded_by:
        return "SparkL"

    cached = get_uploader_name(uploaded_by)
    if cached:
        return cached

    try:
        res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", uploaded_by)
            .maybe_single()
            .execute()
        )
        name = (res.data or {}).get("full_name") or "SparkL User"
    except Exception:
        name = "SparkL User"

    set_uploader_name(uploaded_by, name)
    return name


def _check_course_access(user_id: str, course_id: Optional[str]) -> None:
    if not course_id:
        return
    try:
        res = (
            supabase.table("user_courses")
            .select("id")
            .eq("user_id", user_id)
            .eq("course_id", course_id)
            .maybe_single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=403, detail="You don't have access to this course.")
    except HTTPException:
        raise
    except Exception:
        pass


def _render_base_page(pdf_bytes: bytes, page_num: int) -> bytes:
    """
    Convert one PDF page to a raw JPEG (no watermark).
    Result is stored in cache — this function is only called on a cache miss.
    """
    try:
        pages = convert_from_bytes(
            pdf_bytes,
            dpi=150,
            first_page=page_num,
            last_page=page_num,
            fmt="jpeg",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not render page: {e}")

    if not pages:
        raise HTTPException(status_code=404, detail=f"Page {page_num} does not exist.")

    buf = io.BytesIO()
    pages[0].save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _get_base_page_bytes(question_id: str, page_num: int, file_url: str) -> bytes:
    """
    Return base page JPEG bytes — from cache if available, otherwise render + cache.
    """
    cached = get_base_page(question_id, page_num)
    if cached:
        return cached

    # Cache miss — download PDF and render
    pdf_bytes  = _download_from_b2(file_url)
    jpeg_bytes = _render_base_page(pdf_bytes, page_num)
    set_base_page(question_id, page_num, jpeg_bytes)
    return jpeg_bytes


# ── Page image endpoint ────────────────────────────────────────────────────────

@router.get(
    "/{question_id}/page/{page_num}",
    response_class=Response,
    summary="Return a single watermarked JPEG page of a past question PDF",
)
async def get_page_image(
    question_id: str = Path(...),
    page_num:    int  = Path(..., ge=1, le=500),
    user_id:     str  = Depends(get_current_user),
):
    if not PDF2IMAGE_OK:
        raise HTTPException(status_code=500, detail="pdf2image is not installed.")
    if not PILLOW_OK:
        raise HTTPException(status_code=500, detail="Pillow is not installed.")

    # 1. Subscription gate — always live, never cached
    limits = get_user_limits(user_id)
    if not limits.get("is_paid") and page_num > FREE_PAGE_LIMIT:
        raise HTTPException(status_code=403, detail="Upgrade your plan to view more pages.")

    # 2. Question metadata (cached)
    q = _fetch_question_meta(question_id)

    mime = q.get("mime_type", "application/pdf") or ""
    if not mime.startswith("application/pdf"):
        raise HTTPException(status_code=400, detail="This file is not a PDF.")

    # 3. Course access — always live
    _check_course_access(user_id, q.get("course_id"))

    # 4. Uploader name (cached)
    uploader_name = _fetch_uploader_name(q.get("uploaded_by"))

    # 5. Base page image (cached — same for all users)
    jpeg_bytes = _get_base_page_bytes(question_id, page_num, q["file_url"])

    # 6. Apply per-user watermark on top of the cached base image
    base_img    = Image.open(io.BytesIO(jpeg_bytes))
    watermarked = _apply_watermark(base_img, uploader_name)

    out = io.BytesIO()
    watermarked.save(out, format="JPEG", quality=88, optimize=True)
    out.seek(0)

    return Response(
        content=out.read(),
        media_type="image/jpeg",
        headers={
            "Cache-Control":          "no-store, no-cache, must-revalidate, private",
            "Pragma":                 "no-cache",
            "Expires":                "0",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition":    "inline",
        },
    )


# ── Page count endpoint ────────────────────────────────────────────────────────

@router.get(
    "/{question_id}/page-count",
    summary="Return total page count (cached 24 h)",
)
async def get_page_count_endpoint(
    question_id: str = Path(...),
    user_id:     str  = Depends(get_current_user),
):
    # Check cache first
    cached_count = get_page_count(question_id)
    if cached_count is not None:
        return {"page_count": cached_count}

    q    = _fetch_question_meta(question_id)
    mime = q.get("mime_type", "application/pdf") or ""
    if not mime.startswith("application/pdf"):
        return {"page_count": 1}

    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf is not installed.")

    pdf_bytes = _download_from_b2(q["file_url"])
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        count  = len(reader.pages)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read PDF: {e}")

    set_page_count(question_id, count)
    return {"page_count": count}


# ── Cache stats (admin only — wire up your admin auth) ────────────────────────

@router.get("/debug/cache-stats", include_in_schema=False)
async def get_cache_stats(user_id: str = Depends(get_current_user)):
    # TODO: add admin check here
    return cache_stats()
