# app/routers/admin_sections.py
"""
Admin review of multi-course source documents and their sections.

Endpoints:
  GET    /api/admin/source-documents               list all source documents
  GET    /api/admin/source-documents/{id}          single document + its sections
  PATCH  /api/admin/source-documents/{id}/status   approve / reject the whole doc
  GET    /api/admin/sections/{section_id}           single section detail
  PATCH  /api/admin/sections/{section_id}/text      correct extracted text
  POST   /api/admin/sections/{section_id}/process   run AI question generation
  PATCH  /api/admin/sections/{section_id}/status    approve / reject one section
  GET    /api/admin/sections/{section_id}/page/{n}  watermarked page preview
"""
from __future__ import annotations

import io
import math
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.admin_auth import get_current_admin
from app.storage import download_bytes
from app.supabase_client import supabase

try:
    from PIL import Image, ImageDraw, ImageFont
    _PIL_OK = True
except ImportError:
    _PIL_OK = False

router = APIRouter(prefix="/api/admin", tags=["admin-sections"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class DocStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "pending"]
    reason: Optional[str] = None


class SectionStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "pending"]
    reason: Optional[str] = None


class SectionTextUpdate(BaseModel):
    extracted_text: str = Field(..., min_length=1, max_length=50_000)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_uuid(value: str, label: str = "id") -> None:
    try:
        UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")


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


def _watermark_page(img: "Image.Image", admin_id: str) -> "Image.Image":
    """Tiled watermark + footer bar — same style as existing admin preview."""
    img = img.convert("RGBA")
    w, h = img.size
    font_size = max(18, w // 35)
    font = _get_font(font_size)
    text = "SPARKL ADMIN"
    color = (99, 102, 241, 30)

    diag = int(math.hypot(w, h))
    canvas = Image.new("RGBA", (diag * 2, diag * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = (bbox[2] - bbox[0]) + 48
    th = (bbox[3] - bbox[1]) + 48
    for row in range(-2, (canvas.height // th) + 3):
        for col in range(-2, (canvas.width // tw) + 3):
            x = col * tw + (row % 2) * (tw // 2)
            y = row * th
            draw.text((x, y), text, font=font, fill=color)
    canvas = canvas.rotate(-26, resample=Image.BICUBIC)
    ox = (canvas.width - w) // 2
    oy = (canvas.height - h) // 2
    cropped = canvas.crop((ox, oy, ox + w, oy + h))
    img = Image.alpha_composite(img, cropped)

    bar_h = max(32, h // 28)
    ffont = _get_font(max(11, w // 60))
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    footer = f"Admin review only — SparkL  ·  {admin_id[:8]}…  ·  {stamp}"
    draw2 = ImageDraw.Draw(img)
    draw2.rectangle([(0, h - bar_h), (w, h)], fill=(10, 10, 30, 200))
    fb = draw2.textbbox((0, 0), footer, font=ffont)
    tx = (w - (fb[2] - fb[0])) // 2
    ty = h - bar_h + (bar_h - (fb[3] - fb[1])) // 2
    draw2.text((tx, ty), footer, font=ffont, fill=(255, 255, 255, 200))
    return img.convert("RGB")


def _render_watermarked_page_sync(
    file_bytes: bytes,
    mime_type: str,
    page_num: int,
    admin_id: str,
) -> bytes:
    from PIL import Image

    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
        except ImportError:
            raise HTTPException(status_code=500, detail="pypdfium2 not installed.")
        pdf = pdfium.PdfDocument(file_bytes)
        if page_num > len(pdf):
            pdf.close()
            raise HTTPException(status_code=404, detail=f"Page {page_num} does not exist.")
        img = pdf[page_num - 1].render(scale=150 / 72).to_pil().convert("RGB")
        pdf.close()
    else:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    if _PIL_OK:
        img = _watermark_page(img, admin_id)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue()


# ── Routes: source documents ─────────────────────────────────────────────────

@router.get("/source-documents")
async def list_source_documents(
    admin_id: str = Depends(get_current_admin),
):
    """List all source documents with their sections summary."""
    docs = (
        supabase.table("source_documents")
        .select("id, status, mime_type, file_size, page_count, created_at, uploader_id")
        .order("created_at", desc=True)
        .execute()
    ).data or []

    # Attach uploader name
    uploader_ids = list({d["uploader_id"] for d in docs if d.get("uploader_id")})
    profiles: dict[str, dict] = {}
    if uploader_ids:
        p = (
            supabase.table("profiles")
            .select("id, full_name")
            .in_("id", uploader_ids)
            .execute()
        )
        profiles = {r["id"]: r for r in (p.data or [])}

    # Attach section counts
    doc_ids = [d["id"] for d in docs]
    section_counts: dict[str, int] = {}
    if doc_ids:
        secs = (
            supabase.table("course_document_sections")
            .select("source_document_id")
            .in_("source_document_id", doc_ids)
            .execute()
        ).data or []
        for s in secs:
            sid = s["source_document_id"]
            section_counts[sid] = section_counts.get(sid, 0) + 1

    for d in docs:
        p = profiles.get(d.pop("uploader_id", None) or "")
        d["uploader"] = {"full_name": p.get("full_name")} if p else None
        d["section_count"] = section_counts.get(d["id"], 0)

    return docs


@router.get("/source-documents/{source_id}")
async def get_source_document(
    source_id: str,
    admin_id: str = Depends(get_current_admin),
):
    """Single source document with all its sections."""
    _check_uuid(source_id, "source_id")

    doc = (
        supabase.table("source_documents")
        .select("id, status, mime_type, file_size, page_count, created_at, uploader_id")
        .eq("id", source_id)
        .maybe_single()
        .execute()
    ).data
    if not doc:
        raise HTTPException(status_code=404, detail="Source document not found.")

    sections = (
        supabase.table("course_document_sections")
        .select(
            "id, start_page, end_page, processing_status, processing_error, "
            "extraction_quality, extracted_text, "
            "course:courses(id, name)"
        )
        .eq("source_document_id", source_id)
        .order("start_page")
        .execute()
    ).data or []

    doc["sections"] = sections
    return doc


@router.patch("/source-documents/{source_id}/status")
async def update_source_document_status(
    source_id: str,
    payload: DocStatusUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(source_id, "source_id")
    update = {"status": payload.status}
    res = (
        supabase.table("source_documents")
        .update(update)
        .eq("id", source_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Source document not found.")
    return res.data[0]


# ── Routes: individual sections ───────────────────────────────────────────────

@router.get("/sections/{section_id}")
async def get_section(
    section_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(section_id, "section_id")
    res = (
        supabase.table("course_document_sections")
        .select(
            "id, source_document_id, start_page, end_page, extracted_text, "
            "extraction_quality, processing_status, processing_error, "
            "course:courses(id, name)"
        )
        .eq("id", section_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Section not found.")
    return res.data


@router.patch("/sections/{section_id}/text")
async def update_section_text(
    section_id: str,
    payload: SectionTextUpdate,
    admin_id: str = Depends(get_current_admin),
):
    """Admin corrects the extracted text for a section."""
    _check_uuid(section_id, "section_id")
    res = (
        supabase.table("course_document_sections")
        .update({
            "extracted_text":     payload.extracted_text.strip(),
            "extraction_quality": 1.0,
        })
        .eq("id", section_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Section not found.")
    return res.data[0]


@router.patch("/sections/{section_id}/status")
async def update_section_status(
    section_id: str,
    payload: SectionStatusUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(section_id, "section_id")
    if payload.status == "rejected" and not (payload.reason or "").strip():
        raise HTTPException(status_code=400, detail="A reason is required when rejecting.")
    update = {
        "processing_status": payload.status,
        "processing_error":  payload.reason.strip() if payload.status == "rejected" else None,
    }
    res = (
        supabase.table("course_document_sections")
        .update(update)
        .eq("id", section_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Section not found.")
    return res.data[0]


@router.post("/sections/{section_id}/process")
async def process_section_with_ai(
    section_id: str,
    admin_id: str = Depends(get_current_admin),
):
    """
    Run AI question generation for one section.
    Reuses the existing process_questions service.
    """
    _check_uuid(section_id, "section_id")

    sec = (
        supabase.table("course_document_sections")
        .select("id, extracted_text, processing_status, course_id, course:courses(name)")
        .eq("id", section_id)
        .maybe_single()
        .execute()
    ).data
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")

    text = (sec.get("extracted_text") or "").strip()
    if not text or text.startswith("[extraction failed"):
        raise HTTPException(status_code=400, detail="No valid extracted text to process.")

    from app.services.question_processor import ProcessingError, process_questions

    course_name = (sec.get("course") or {}).get("name", "")
    try:
        questions = await run_in_threadpool(process_questions, text, course_name)
    except ProcessingError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not questions:
        raise HTTPException(status_code=500, detail="AI returned no questions.")

    # Delete previous questions for this section before inserting
    supabase.table("questions").delete().eq("section_id", section_id).execute()

    rows = [
        {
            "section_id":       section_id,
            "course_id":        sec["course_id"],
            "question_number":  q.get("question_number"),
            "question_text":    q.get("question_text", ""),
            "question_type":    q.get("question_type", "theory"),
            "option_a":         q.get("option_a"),
            "option_b":         q.get("option_b"),
            "option_c":         q.get("option_c"),
            "option_d":         q.get("option_d"),
            "correct_answer":   q.get("correct_answer"),
            "model_answer":     q.get("model_answer"),
            "explanation":      q.get("explanation"),
            "topic_tag":        q.get("topic_tag"),
            "difficulty":       q.get("difficulty"),
            "marks":            q.get("marks"),
            "ai_processed":     True,
            "is_verified":      False,
            "edited_by_admin":  False,
        }
        for q in questions
    ]
    inserted = supabase.table("questions").insert(rows).execute()
    supabase.table("course_document_sections").update(
        {"processing_status": "ready", "processing_error": None}
    ).eq("id", section_id).execute()

    return {"processed": True, "questions_created": len(inserted.data or [])}


@router.get("/sections/{section_id}/page/{page_num}", response_class=Response)
async def get_section_page_preview(
    section_id: str,
    page_num: int = Path(..., ge=1),
    admin_id: str = Depends(get_current_admin),
):
    """
    Watermarked page image for admin preview.
    Only pages within the section's range are allowed.
    """
    _check_uuid(section_id, "section_id")

    sec = (
        supabase.table("course_document_sections")
        .select("id, start_page, end_page, source_document_id")
        .eq("id", section_id)
        .maybe_single()
        .execute()
    ).data
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found.")

    if page_num < sec["start_page"] or page_num > sec["end_page"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Page {page_num} is outside this section "
                f"(pages {sec['start_page']}–{sec['end_page']})."
            ),
        )

    src = (
        supabase.table("source_documents")
        .select("file_key, mime_type")
        .eq("id", sec["source_document_id"])
        .maybe_single()
        .execute()
    ).data
    if not src:
        raise HTTPException(status_code=404, detail="Source document not found.")

    file_bytes = await run_in_threadpool(download_bytes, src["file_key"])
    jpeg = await run_in_threadpool(
        _render_watermarked_page_sync,
        file_bytes,
        src["mime_type"],
        page_num,
        str(admin_id),
    )
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma":        "no-cache",
            "Expires":       "0",
        },
    )
