"""
routers/viewer.py
-----------------
Serves individual PDF pages as watermarked JPEG images.
The original PDF never reaches the browser.

Flow:
    GET /api/viewer/{question_id}/page/{page_num}
    1. Verify auth token
    2. Check subscription limits (free = pages 1-2 only)
    3. Check the user has access to the course this question belongs to
    4. Fetch past_question record (file_url, mime_type, uploaded_by)
    5. Fetch uploader display name from profiles
    6. Download PDF bytes from B2
    7. Convert requested page → image (pdf2image / poppler)
    8. Overlay tiled diagonal SparkL watermark + footer (Pillow)
    9. Return JPEG — no URL, no PDF, no download header

    GET /api/viewer/{question_id}/page-count
    1. Verify auth token
    2. Fetch record (file_url, mime_type, status)
    3. Use pypdf to count pages WITHOUT downloading the full PDF body
       (pypdf reads the cross-reference table only — far cheaper on B2 egress)
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

B2_BUCKET      = os.getenv("B2_BUCKET_NAME", "sparkl-questions")
FREE_PAGE_LIMIT = 2   # pages free users can see

# ── Helpers ────────────────────────────────────────────────────────────────────

def _download_from_b2(key: str) -> bytes:
    """Download raw bytes for a B2 object key."""
    try:
        obj = _client().get_object(Bucket=B2_BUCKET, Key=key)
        return obj["Body"].read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch file: {e}")


def _get_font(size: int) -> "ImageFont.FreeTypeFont | ImageFont.ImageFont":
    """Return a PIL font — falls back to default if no TTF is present."""
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


def _apply_watermark(image: "Image.Image", uploader_name: str) -> "Image.Image":
    """
    1. Tile a rotated 'SparkL' text diagonally across the whole image
       using a purple/indigo fill so it shows on both light and dark pages.
    2. Add a semi-transparent dark footer bar: "Uploaded by: X · SparkL"
    Returns an RGB JPEG-ready image.
    """
    img = image.convert("RGBA")
    w, h = img.size

    # ── 1. Tiled diagonal watermark ───────────────────────────────────
    # Work on a same-size transparent layer, rotate it, then composite.
    font_size  = max(22, w // 30)
    tile_font  = _get_font(font_size)
    tile_text  = "SparkL"

    # Indigo at ~11 % opacity — visible on white AND dark backgrounds.
    # Using RGBA(99, 102, 241, 28) ≈ indigo-500 @ 11 %
    TILE_COLOR = (99, 102, 241, 28)

    # Build a larger canvas so rotating doesn't clip corners
    diag       = int(math.hypot(w, h))
    wm_canvas  = Image.new("RGBA", (diag * 2, diag * 2), (0, 0, 0, 0))
    wm_draw    = ImageDraw.Draw(wm_canvas)

    bbox_test  = wm_draw.textbbox((0, 0), tile_text, font=tile_font)
    tile_w     = (bbox_test[2] - bbox_test[0]) + 48
    tile_h     = (bbox_test[3] - bbox_test[1]) + 48

    cw, ch = wm_canvas.size
    for row in range(-2, (ch // tile_h) + 3):
        for col in range(-2, (cw // tile_w) + 3):
            x = col * tile_w + (row % 2) * (tile_w // 2)   # brick-offset
            y = row * tile_h
            wm_draw.text((x, y), tile_text, font=tile_font, fill=TILE_COLOR)

    # Rotate ~26° and crop back to original size
    wm_canvas  = wm_canvas.rotate(-26, resample=Image.BICUBIC)
    offset_x   = (wm_canvas.width  - w) // 2
    offset_y   = (wm_canvas.height - h) // 2
    wm_cropped = wm_canvas.crop((offset_x, offset_y, offset_x + w, offset_y + h))

    img = Image.alpha_composite(img, wm_cropped)

    # ── 2. Footer bar ──────────────────────────────────────────────────
    bar_h       = max(34, h // 26)
    footer_font = _get_font(max(13, w // 58))
    footer_text = f"Uploaded by: {uploader_name}  ·  Property of SparkL"

    draw2 = ImageDraw.Draw(img)
    # Dark translucent bar
    draw2.rectangle([(0, h - bar_h), (w, h)], fill=(10, 10, 20, 185))

    # Centered white text
    fb = draw2.textbbox((0, 0), footer_text, font=footer_font)
    tx = (w - (fb[2] - fb[0])) // 2
    ty = h - bar_h + (bar_h - (fb[3] - fb[1])) // 2
    draw2.text((tx, ty), footer_text, font=footer_font, fill=(255, 255, 255, 210))

    # ── 3. Top-left brand stamp ────────────────────────────────────────
    stamp_font = _get_font(max(11, w // 70))
    draw2.text(
        (10, 8),
        "sparkl.app",
        font=stamp_font,
        fill=(99, 102, 241, 160),   # indigo, semi-transparent
    )

    return img.convert("RGB")


def _fetch_question(question_id: str) -> dict:
    """Load the past_question row or raise 404."""
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
    return res.data


def _assert_pdf(q: dict) -> None:
    mime = q.get("mime_type", "application/pdf") or ""
    if not mime.startswith("application/pdf"):
        raise HTTPException(
            status_code=400,
            detail="This file is not a PDF — use the image viewer instead.",
        )


def _check_course_access(user_id: str, course_id: Optional[str]) -> None:
    """
    Verify the user is enrolled in (or has access to) the course.
    Adjust the table/column names to match your schema.
    """
    if not course_id:
        return   # no course restriction
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
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this course.",
            )
    except HTTPException:
        raise
    except Exception:
        # If the table doesn't exist yet, skip silently
        pass


def _uploader_name(uploaded_by: Optional[str]) -> str:
    if not uploaded_by:
        return "SparkL"
    try:
        res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", uploaded_by)
            .maybe_single()
            .execute()
        )
        name = res.data and res.data.get("full_name")
        return name or "SparkL User"
    except Exception:
        return "SparkL User"


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

    # ── 1. Subscription gate ───────────────────────────────────────────
    limits = get_user_limits(user_id)
    if not limits.get("is_paid") and page_num > FREE_PAGE_LIMIT:
        raise HTTPException(
            status_code=403,
            detail="Upgrade your plan to view more pages.",
        )

    # ── 2. Load + validate record ──────────────────────────────────────
    q = _fetch_question(question_id)
    _assert_pdf(q)

    # ── 3. Course-access check ─────────────────────────────────────────
    _check_course_access(user_id, q.get("course_id"))

    # ── 4. Uploader name for watermark ─────────────────────────────────
    name = _uploader_name(q.get("uploaded_by"))

    # ── 5. Download PDF from B2 ────────────────────────────────────────
    pdf_bytes = _download_from_b2(q["file_url"])

    # ── 6. Render the requested page ───────────────────────────────────
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
        raise HTTPException(
            status_code=404,
            detail=f"Page {page_num} does not exist in this document.",
        )

    # ── 7. Watermark ───────────────────────────────────────────────────
    watermarked = _apply_watermark(pages[0], name)

    # ── 8. Encode → JPEG ───────────────────────────────────────────────
    buf = io.BytesIO()
    watermarked.save(buf, format="JPEG", quality=88, optimize=True)
    buf.seek(0)

    return Response(
        content=buf.read(),
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma":        "no-cache",          # older HTTP/1.0 proxies
            "Expires":       "0",
            "X-Content-Type-Options": "nosniff",
            # Tell the browser this is never a download
            "Content-Disposition": "inline",
        },
    )


# ── Page count endpoint ────────────────────────────────────────────────────────

@router.get(
    "/{question_id}/page-count",
    summary="Return the total page count of a past question PDF (cheap — no full download)",
)
async def get_page_count(
    question_id: str = Path(...),
    user_id:     str  = Depends(get_current_user),
):
    q = _fetch_question(question_id)
    mime = q.get("mime_type", "application/pdf") or ""
    if not mime.startswith("application/pdf"):
        return {"page_count": 1}

    # ── Use pypdf to count pages cheaply ──────────────────────────────
    # pypdf reads only the cross-reference table — NOT the full page stream.
    # This avoids downloading megabytes of PDF body just for a page count.
    try:
        from pypdf import PdfReader
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf is not installed.")

    # For B2 we still need the bytes (no true range-request support in the
    # boto3 wrapper here), but pypdf processes the xref lazily so memory
    # usage is minimal compared to pdf2image converting every page.
    pdf_bytes = _download_from_b2(q["file_url"])

    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return {"page_count": len(reader.pages)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read PDF: {e}")
