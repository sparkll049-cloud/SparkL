# app/services/page_renderer.py
"""
Renders a PDF (or image) to per-page JPEGs and stores them in Backblaze.
Called once at upload time — never at view time.

Stored under:  page-images/{question_id}/page-{n}.jpg
Page count is saved back to past_questions.page_count in Supabase.
"""
from __future__ import annotations

import io

from app.storage import upload_bytes, list_keys_with_prefix
from app.supabase_client import supabase

# Render at 120 DPI — good quality, much lighter than 150 DPI
# 150/72 = 2.08x scale, 120/72 = 1.67x scale → ~35% less memory per page
RENDER_SCALE = 120 / 72
JPEG_QUALITY = 80
MAX_IMAGE_WIDTH = 1400  # px — cap very wide scans


def _page_key(question_id: str, page_number: int) -> str:
    return f"page-images/{question_id}/page-{page_number}.jpg"


def pages_already_rendered(question_id: str) -> bool:
    """Return True if page images already exist in B2 for this question."""
    keys = list_keys_with_prefix(f"page-images/{question_id}/")
    return len(keys) > 0


def render_and_store_pages(
    question_id: str,
    file_bytes: bytes,
    mime_type: str,
) -> int:
    """
    Render every page to a JPEG and upload to Backblaze.
    Returns total page count.
    Skips silently if pages already exist.
    """
    if pages_already_rendered(question_id):
        # Count existing pages and return
        keys = list_keys_with_prefix(f"page-images/{question_id}/")
        return len(keys)

    if mime_type == "application/pdf":
        total = _render_pdf(question_id, file_bytes)
    else:
        total = _render_image(question_id, file_bytes)

    # Save page count to Supabase
    try:
        supabase.table("past_questions").update(
            {"page_count": total}
        ).eq("id", question_id).execute()
    except Exception:
        pass  # non-critical — viewer can still work without it

    return total


def _render_pdf(question_id: str, file_bytes: bytes) -> int:
    try:
        import pypdfium2 as pdfium
    except ImportError:
        raise RuntimeError("pypdfium2 is not installed.")

    from PIL import Image

    pdf = pdfium.PdfDocument(file_bytes)
    total = len(pdf)

    for i in range(total):
        page_num = i + 1
        page = pdf[i]

        bitmap = page.render(scale=RENDER_SCALE)
        pil_img = bitmap.to_pil()

        # Cap width to save storage
        if pil_img.width > MAX_IMAGE_WIDTH:
            ratio = MAX_IMAGE_WIDTH / pil_img.width
            pil_img = pil_img.resize(
                (MAX_IMAGE_WIDTH, int(pil_img.height * ratio)),
                Image.LANCZOS,
            )

        buf = io.BytesIO()
        pil_img.convert("RGB").save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)

        upload_bytes(
            file_bytes=buf.getvalue(),
            key=_page_key(question_id, page_num),
            mime_type="image/jpeg",
        )

    return total


def _render_image(question_id: str, file_bytes: bytes) -> int:
    from PIL import Image

    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    if img.width > MAX_IMAGE_WIDTH:
        ratio = MAX_IMAGE_WIDTH / img.width
        img = img.resize(
            (MAX_IMAGE_WIDTH, int(img.height * ratio)),
            Image.LANCZOS,
        )

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)

    upload_bytes(
        file_bytes=buf.getvalue(),
        key=_page_key(question_id, 1),
        mime_type="image/jpeg",
    )

    return 1