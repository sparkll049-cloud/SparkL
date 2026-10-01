# app/routers/section_questions.py
"""
Student-facing endpoints for questions that came from
multi-course source documents.

Free users  → extracted question text only, up to FREE_QUESTION_LIMIT per course.
Paid users  → extracted text + source page images for their course only.

The original PDF is NEVER exposed. Page images are served only
for pages within the student's section (course page range).
"""
from __future__ import annotations

import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.routers.uploads import get_current_user_id
from app.storage import download_bytes
from app.supabase_client import supabase

router = APIRouter(prefix="/api/sections", tags=["Section Questions"])

FREE_QUESTION_LIMIT = 10   # TODO: confirm with product — per course or per user overall?

_IMG_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}


# ── Subscription helper ───────────────────────────────────────────────────────

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


def _is_admin(user_id: str) -> bool:
    try:
        res = (
            supabase.table("profiles")
            .select("is_admin")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return bool(res.data and res.data.get("is_admin"))
    except Exception:
        return False


# ── Watermark helper (reused from viewer.py style) ────────────────────────────

def _add_watermark_sync(img, text: str):
    from PIL import Image, ImageDraw
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(-img.height, img.height * 2, 160):
        for x in range(-img.width, img.width * 2, 320):
            draw.text((x, y), text, fill=(140, 140, 140, 55))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def _fetch_page_jpeg_sync(
    file_key: str,
    mime_type: str,
    page_num: int,
    user_email: str,
) -> bytes:
    from PIL import Image

    file_bytes = download_bytes(file_key)

    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
        except ImportError:
            raise HTTPException(status_code=500, detail="pypdfium2 not installed.")
        pdf = pdfium.PdfDocument(file_bytes)
        if page_num > len(pdf):
            pdf.close()
            raise HTTPException(status_code=404, detail=f"Page {page_num} does not exist.")
        img = pdf[page_num - 1].render(scale=120 / 72).to_pil().convert("RGB")
        pdf.close()
    else:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    img = _add_watermark_sync(img, f"SparkL · {user_email}")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{section_id}/questions")
async def get_section_questions(
    section_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Return questions for a course section.

    Free users get up to FREE_QUESTION_LIMIT questions (text only).
    Paid users get all questions (text only — page images are a separate endpoint).
    """
    try:
        UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section id.")

    # Confirm section exists and is approved
    sec = (
        supabase.table("course_document_sections")
        .select("id, processing_status, course_id")
        .eq("id", section_id)
        .maybe_single()
        .execute()
    ).data
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")
    if sec["processing_status"] != "approved" and not _is_admin(str(user_id)):
        raise HTTPException(status_code=404, detail="Section not found.")

    sub = await run_in_threadpool(_get_subscription, str(user_id))
    is_paid = sub["is_paid"] or _is_admin(str(user_id))

    questions = (
        supabase.table("questions")
        .select(
            "id, question_number, question_text, question_type, "
            "option_a, option_b, option_c, option_d, "
            "correct_answer, model_answer, explanation, topic_tag, difficulty, marks"
        )
        .eq("section_id", section_id)
        .order("question_number")
        .execute()
    ).data or []

    # Enforce free question limit server-side
    if not is_paid:
        questions = questions[:FREE_QUESTION_LIMIT]

    return {
        "section_id":  section_id,
        "is_paid":     is_paid,
        "total":       len(questions),
        "questions":   questions,
    }


@router.get("/{section_id}/page/{page_num}", response_class=Response)
async def get_section_page_image(
    section_id: str,
    page_num: int,
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Return a watermarked page image for a PAID user.

    Enforces:
    - Paid subscription required
    - Page must be within this section's range (no cross-course leakage)
    - Source document must be approved
    """
    try:
        UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section id.")

    # Check subscription first before doing any DB work
    sub = await run_in_threadpool(_get_subscription, str(user_id))
    admin = _is_admin(str(user_id))
    if not sub["is_paid"] and not admin:
        raise HTTPException(
            status_code=403,
            detail="Page images are available to paid subscribers only.",
        )

    # Fetch section
    sec = (
        supabase.table("course_document_sections")
        .select("id, start_page, end_page, processing_status, source_document_id")
        .eq("id", section_id)
        .maybe_single()
        .execute()
    ).data
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")
    if sec["processing_status"] != "approved" and not admin:
        raise HTTPException(status_code=404, detail="Section not found.")

    # Enforce page range — prevents a user from requesting other courses' pages
    if page_num < sec["start_page"] or page_num > sec["end_page"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Page {page_num} is not part of this course section "
                f"(pages {sec['start_page']}–{sec['end_page']})."
            ),
        )

    # Fetch source document for the file key
    src = (
        supabase.table("source_documents")
        .select("file_key, mime_type, status")
        .eq("id", sec["source_document_id"])
        .maybe_single()
        .execute()
    ).data
    if not src:
        raise HTTPException(status_code=404, detail="Source document not found.")
    if src["status"] != "approved" and not admin:
        raise HTTPException(status_code=404, detail="Source document not found.")

    # Get user email for watermark
    user_res = supabase.auth.admin.get_user_by_id(str(user_id))
    user_email = (user_res.user.email if user_res and user_res.user else None) or str(user_id)

    jpeg = await run_in_threadpool(
        _fetch_page_jpeg_sync,
        src["file_key"],
        src["mime_type"],
        page_num,
        user_email,
    )
    return Response(content=jpeg, media_type="image/jpeg", headers=_IMG_HEADERS)
