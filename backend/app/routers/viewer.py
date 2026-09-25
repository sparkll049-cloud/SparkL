"""
routers/viewer.py
-----------------
Serves individual PDF pages as watermarked JPEG images.
The original PDF never reaches the browser.

Flow:
    GET /api/viewer/{question_id}/page/{page_num}
    1. Verify auth token
    2. Check subscription + course access
    3. Fetch past_question record (file_url, mime_type, uploaded_by)
    4. Fetch uploader name from profiles
    5. Download PDF bytes from B2
    6. Convert requested page to image (pdf2image)
    7. Overlay tiled SparkL watermark + "Uploaded by" footer (Pillow)
    8. Return JPEG bytes — no URL, no PDF, no download
"""

from __future__ import annotations

import io
import os
from datetime import date
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

B2_BUCKET = os.getenv("B2_BUCKET_NAME", "sparkl-questions")

# ── Helpers ────────────────────────────────────────────────────────────────────

def _download_from_b2(key: str) -> bytes:
    """Download raw bytes for a B2 object key."""
    try:
        obj = _client().get_object(Bucket=B2_BUCKET, Key=key)
        return obj["Body"].read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch file: {e}")


def _get_font(size: int):
    """Return a PIL font — falls back to default if no TTF available."""
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except Exception:
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", size)
        except Exception:
            return ImageFont.load_default()


def _apply_watermark(image: "Image.Image", uploader_name: str) -> "Image.Image":
    """
    Overlay a tiled diagonal 'SparkL' watermark across the full image,
    plus an 'Uploaded by' footer at the bottom.
    """
    img = image.convert("RGBA")
    w, h = img.size

    # ── Tiled watermark layer ──────────────────────────────────────────
    wm_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw     = ImageDraw.Draw(wm_layer)

    tile_font  = _get_font(max(18, w // 35))
    tile_text  = "SparkL"
    tile_color = (255, 255, 255, 28)   # very subtle white

    # Measure one tile
    bbox      = draw.textbbox((0, 0), tile_text, font=tile_font)
    tile_w    = bbox[2] - bbox[0] + 40
    tile_h    = bbox[3] - bbox[1] + 40

    # Tile diagonally across the whole image
    for row in range(-2, (h // tile_h) + 3):
        for col in range(-2, (w // tile_w) + 3):
            x = col * tile_w + (row % 2) * (tile_w // 2)
            y = row * tile_h
            draw.text((x, y), tile_text, font=tile_font, fill=tile_color)

    # Merge watermark layer onto image
    img = Image.alpha_composite(img, wm_layer)

    # ── Footer bar ─────────────────────────────────────────────────────
    footer_font  = _get_font(max(14, w // 55))
    footer_text  = f"Uploaded by: {uploader_name}  ·  SparkL"
    footer_color = (255, 255, 255, 180)
    bar_h        = max(32, h // 28)

    draw2 = ImageDraw.Draw(img)

    # Semi-transparent dark bar
    draw2.rectangle([(0, h - bar_h), (w, h)], fill=(0, 0, 0, 160))

    # Centered footer text
    fb = draw2.textbbox((0, 0), footer_text, font=footer_font)
    tx = (w - (fb[2] - fb[0])) // 2
    ty = h - bar_h + (bar_h - (fb[3] - fb[1])) // 2
    draw2.text((tx, ty), footer_text, font=footer_font, fill=footer_color)

    return img.convert("RGB")


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get(
    "/{question_id}/page/{page_num}",
    response_class=Response,
    summary="Return a single watermarked page image of a past question PDF",
)
async def get_page_image(
    question_id: str = Path(...),
    page_num:    int  = Path(..., ge=1, le=200),
    user_id: str = Depends(get_current_user),
):
    if not PDF2IMAGE_OK:
        raise HTTPException(status_code=500, detail="pdf2image is not installed.")
    if not PILLOW_OK:
        raise HTTPException(status_code=500, detail="Pillow is not installed.")

    # ── Auth: subscription check ───────────────────────────────────────
    limits = get_user_limits(user_id)
    if not limits["is_paid"]:
        # Free users can only view first 2 pages
        if page_num > 2:
            raise HTTPException(
                status_code=403,
                detail="Upgrade your plan to view more pages.",
            )

    # ── Fetch question record ──────────────────────────────────────────
    try:
        q_res = (
            supabase.table("past_questions")
            .select("id, file_url, mime_type, uploaded_by, status")
            .eq("id", question_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found.")

    if not q_res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    q = q_res.data

    if q["status"] != "approved":
        raise HTTPException(status_code=403, detail="This question is not yet approved.")

    mime_type = q.get("mime_type", "application/pdf")
    if not mime_type or not mime_type.startswith("application/pdf"):
        raise HTTPException(
            status_code=400,
            detail="This file is not a PDF — use the image viewer instead.",
        )

    # ── Fetch uploader name ────────────────────────────────────────────
    uploader_name = "SparkL User"
    try:
        p_res = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", q["uploaded_by"])
            .maybe_single()
            .execute()
        )
        if p_res.data and p_res.data.get("full_name"):
            uploader_name = p_res.data["full_name"]
    except Exception:
        pass   # non-critical — watermark still shows "SparkL User"

    # ── Download PDF from B2 ───────────────────────────────────────────
    pdf_bytes = _download_from_b2(q["file_url"])

    # ── Convert requested page to image ───────────────────────────────
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

    page_image = pages[0]

    # ── Apply watermark ────────────────────────────────────────────────
    watermarked = _apply_watermark(page_image, uploader_name)

    # ── Encode to JPEG bytes ───────────────────────────────────────────
    buf = io.BytesIO()
    watermarked.save(buf, format="JPEG", quality=88, optimize=True)
    buf.seek(0)

    return Response(
        content=buf.read(),
        media_type="image/jpeg",
        headers={
            # No caching — every request is auth-checked
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ── Page count endpoint ────────────────────────────────────────────────────────

@router.get(
    "/{question_id}/page-count",
    summary="Return the total number of pages in a past question PDF",
)
async def get_page_count(
    question_id: str = Path(...),
    user_id: str = Depends(get_current_user),
):
    try:
        q_res = (
            supabase.table("past_questions")
            .select("file_url, mime_type, status")
            .eq("id", question_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Question not found.")

    if not q_res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    q = q_res.data

    if q["status"] != "approved":
        raise HTTPException(status_code=403, detail="Not approved.")

    mime_type = q.get("mime_type", "application/pdf")
    if not mime_type or not mime_type.startswith("application/pdf"):
        return {"page_count": 1}

    pdf_bytes = _download_from_b2(q["file_url"])

    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        return {"page_count": len(reader.pages)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read PDF: {e}")
