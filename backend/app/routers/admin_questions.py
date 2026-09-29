from __future__ import annotations

import io
import math
import os
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.admin_auth import get_current_admin
from app.services.question_processor import ProcessingError, process_questions
from app.services.watermarked_preview import watermark_preview
from app.storage import delete_file, download_bytes, get_signed_url, upload_bytes
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

router = APIRouter(prefix="/api/admin/questions", tags=["admin-questions"])
MAX_EXTRACTED_TEXT_LENGTH = 50_000
PREVIEW_EXPIRY_SECONDS = 300

B2_BUCKET = os.getenv("B2_BUCKET_NAME", "sparkl-questions")

ITEM_COLUMNS = (
    "id, question_number, question_text, question_type, option_a, option_b, "
    "option_c, option_d, correct_answer, model_answer, explanation, topic_tag, "
    "difficulty, marks, is_verified, edited_by_admin"
)


class StatusUpdate(BaseModel):
    status: Literal["pending", "approved", "rejected"]
    reason: Optional[str] = None


class ExtractedTextUpdate(BaseModel):
    extracted_text: str


class QuestionItemUpdate(BaseModel):
    question_text: Optional[str] = Field(None, max_length=5000)
    question_type: Optional[Literal["mcq", "theory"]] = None
    option_a: Optional[str] = Field(None, max_length=1000)
    option_b: Optional[str] = Field(None, max_length=1000)
    option_c: Optional[str] = Field(None, max_length=1000)
    option_d: Optional[str] = Field(None, max_length=1000)
    correct_answer: Optional[Literal["a", "b", "c", "d"]] = None
    model_answer: Optional[str] = Field(None, max_length=10000)
    explanation: Optional[str] = Field(None, max_length=5000)
    topic_tag: Optional[str] = Field(None, max_length=100)
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
    marks: Optional[int] = Field(None, ge=0, le=1000)
    is_verified: Optional[bool] = None


def _to_key(file_url: str) -> str:
    """
    Normalise file_url to a plain B2 key.
    Old uploads stored the full URL; new ones store just the key.

    Full URL example:
      https://f005.backblazeb2.com/file/sparkl-questions/past-questions/uid/file.pdf
    Key example:
      past-questions/uid/file.pdf
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


def _check_uuid(value: str, label: str = "id") -> None:
    try:
        UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.") from exc


def _first(result) -> Optional[dict]:
    rows = result.data if result else None
    return rows[0] if rows else None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Page-preview helpers (sync — run in threadpool) ───────────────────────────

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


def _apply_admin_watermark(img: "Image.Image", admin_id: str) -> "Image.Image":
    """Light tiled watermark + admin footer bar — applied per page."""
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
    cw, ch = canvas.size
    for row in range(-2, (ch // th) + 3):
        for col in range(-2, (cw // tw) + 3):
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


def _page_count_sync(file_bytes: bytes, mime_type: str) -> int:
    if mime_type == "application/pdf":
        from pypdf import PdfReader
        try:
            return len(PdfReader(io.BytesIO(file_bytes)).pages)
        except Exception:
            return 1
    return 1


def _render_page_sync(
    file_bytes: bytes, mime_type: str, page_num: int, admin_id: str
) -> bytes:
    if mime_type == "application/pdf":
        if not _PDF2IMAGE_OK:
            raise HTTPException(status_code=500, detail="pdf2image is not installed.")
        pages = convert_from_bytes(
            file_bytes, dpi=150, first_page=page_num, last_page=page_num, fmt="jpeg"
        )
        if not pages:
            raise HTTPException(status_code=404, detail=f"Page {page_num} does not exist.")
        buf = io.BytesIO()
        pages[0].save(buf, format="JPEG", quality=92)
        img_bytes = buf.getvalue()
    else:
        img_bytes = file_bytes

    if not _PILLOW_OK:
        return img_bytes

    img = Image.open(io.BytesIO(img_bytes))
    watermarked = _apply_admin_watermark(img, admin_id)
    out = io.BytesIO()
    watermarked.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_questions(
    status: Optional[str] = Query(None),
    admin_id: str = Depends(get_current_admin),
):
    query = (
        supabase.table("past_questions")
        .select(
            "id, title, year, status, processing_status, created_at, "
            "extracted_text, extraction_quality, rejection_reason, uploaded_by, "
            "mime_type, course:courses(name), semester:semesters(name)"
        )
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    questions = query.execute().data or []

    uploader_ids = list({q["uploaded_by"] for q in questions if q.get("uploaded_by")})
    profiles_by_id: dict[str, dict] = {}
    if uploader_ids:
        profiles = (
            supabase.table("profiles")
            .select("id, full_name")
            .in_("id", uploader_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (profiles.data or [])}

    ids = [q["id"] for q in questions]
    processed_ids: set[str] = set()
    if ids:
        result = (
            supabase.table("questions")
            .select("past_question_id")
            .in_("past_question_id", ids)
            .execute()
        )
        processed_ids = {r["past_question_id"] for r in (result.data or [])}

    for question in questions:
        profile = profiles_by_id.get(question.get("uploaded_by"))
        question["uploader"] = {"full_name": profile.get("full_name")} if profile else None
        question.pop("uploaded_by", None)
        question["ai_processed"] = question["id"] in processed_ids
        question.pop("file_url", None)
    return questions


@router.get("/{question_id}/preview-url")
async def get_watermarked_preview_url(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    """Legacy endpoint — kept for compatibility. Prefer preview-page/{n} instead."""
    _check_uuid(question_id, "question id")
    result = (
        supabase.table("past_questions")
        .select("id, file_url, mime_type")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    row = result.data
    if not row or not row.get("file_url"):
        raise HTTPException(status_code=404, detail="Original upload not found.")

    file_key = _to_key(row["file_url"])
    original = await run_in_threadpool(download_bytes, file_key)
    preview_bytes, preview_mime = await run_in_threadpool(
        watermark_preview, original, row.get("mime_type", "application/pdf"), str(admin_id)
    )
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    preview_key = f"admin-previews/{question_id}/{admin_id}/{stamp}.preview"
    await run_in_threadpool(upload_bytes, preview_bytes, preview_key, preview_mime)

    return {
        "url": get_signed_url(preview_key, expires_in=PREVIEW_EXPIRY_SECONDS),
        "expires_in": PREVIEW_EXPIRY_SECONDS,
        "watermarked": True,
    }


@router.get("/{question_id}/preview-page-count")
async def get_admin_preview_page_count(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    result = (
        supabase.table("past_questions")
        .select("id, file_url, mime_type")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    row = result.data
    if not row or not row.get("file_url"):
        raise HTTPException(status_code=404, detail="File not found.")

    file_key = _to_key(row["file_url"])
    file_bytes = await run_in_threadpool(download_bytes, file_key)
    count = await run_in_threadpool(
        _page_count_sync, file_bytes, row.get("mime_type", "application/pdf")
    )
    return {"page_count": count}


@router.get("/{question_id}/preview-page/{page_num}")
async def get_admin_preview_page(
    question_id: str,
    page_num: int = Path(..., ge=1, le=500),
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    result = (
        supabase.table("past_questions")
        .select("id, file_url, mime_type")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    row = result.data
    if not row or not row.get("file_url"):
        raise HTTPException(status_code=404, detail="File not found.")

    file_key = _to_key(row["file_url"])
    file_bytes = await run_in_threadpool(download_bytes, file_key)
    jpeg = await run_in_threadpool(
        _render_page_sync,
        file_bytes,
        row.get("mime_type", "application/pdf"),
        page_num,
        str(admin_id),
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


@router.patch("/{question_id}/status")
async def update_question_status(
    question_id: str,
    payload: StatusUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    if payload.status == "rejected" and not (payload.reason or "").strip():
        raise HTTPException(status_code=400, detail="A reason is required when rejecting.")
    update = {
        "status": payload.status,
        "rejection_reason": payload.reason.strip() if payload.status == "rejected" else None,
    }
    result = supabase.table("past_questions").update(update).eq("id", question_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return result.data[0]


@router.patch("/{question_id}/text")
async def update_extracted_text(
    question_id: str,
    payload: ExtractedTextUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    text = payload.extracted_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Extracted text cannot be empty.")
    if len(text) > MAX_EXTRACTED_TEXT_LENGTH:
        raise HTTPException(status_code=400, detail="Extracted text is too long.")
    result = (
        supabase.table("past_questions")
        .update({"extracted_text": text, "extraction_quality": 1.0})
        .eq("id", question_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return result.data[0]


@router.post("/{question_id}/process")
async def process_question_with_ai(
    question_id: str,
    force: bool = Query(False),
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    result = (
        supabase.table("past_questions")
        .select("id, extracted_text, status, course_id, course:courses(name)")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    record = result.data
    if not record:
        raise HTTPException(status_code=404, detail="Question not found.")
    if record["status"] == "rejected":
        raise HTTPException(status_code=400, detail="Rejected papers can't be processed.")

    extracted_text = (record.get("extracted_text") or "").strip()
    if not extracted_text or extracted_text.startswith("[extraction failed"):
        raise HTTPException(status_code=400, detail="No valid extracted text to process.")

    if not force:
        reviewed = (
            supabase.table("questions")
            .select("id")
            .eq("past_question_id", question_id)
            .or_("is_verified.eq.true,edited_by_admin.eq.true")
            .limit(1)
            .execute()
        )
        if reviewed.data:
            raise HTTPException(
                status_code=409,
                detail="Reviewed questions exist; use force=true to regenerate.",
            )

    course_name = (record.get("course") or {}).get("name", "")
    try:
        questions = await run_in_threadpool(process_questions, extracted_text, course_name)
    except ProcessingError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if not questions:
        raise HTTPException(status_code=500, detail="Gemini returned no questions.")

    supabase.table("questions").delete().eq("past_question_id", question_id).execute()
    rows = [
        {
            "past_question_id": question_id,
            "course_id": record["course_id"],
            "question_number": q.get("question_number"),
            "question_text": q.get("question_text", ""),
            "question_type": q.get("question_type", "theory"),
            "option_a": q.get("option_a"),
            "option_b": q.get("option_b"),
            "option_c": q.get("option_c"),
            "option_d": q.get("option_d"),
            "correct_answer": q.get("correct_answer"),
            "model_answer": q.get("model_answer"),
            "explanation": q.get("explanation"),
            "topic_tag": q.get("topic_tag"),
            "difficulty": q.get("difficulty"),
            "marks": q.get("marks"),
            "ai_processed": True,
            "is_verified": False,
            "edited_by_admin": False,
        }
        for q in questions
    ]
    inserted = supabase.table("questions").insert(rows).execute()
    supabase.table("past_questions").update(
        {"processing_status": "ready", "processing_error": None}
    ).eq("id", question_id).execute()
    return {"processed": True, "questions_created": len(inserted.data or [])}


@router.get("/{question_id}/processed-questions")
async def get_processed_questions(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    result = (
        supabase.table("questions")
        .select(ITEM_COLUMNS)
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )
    return result.data or []


@router.patch("/{question_id}/items/{item_id}")
async def update_question_item(
    question_id: str,
    item_id: str,
    payload: QuestionItemUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    _check_uuid(item_id, "item id")
    existing = _first(
        supabase.table("questions")
        .select(ITEM_COLUMNS)
        .eq("id", item_id)
        .eq("past_question_id", question_id)
        .limit(1)
        .execute()
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found.")

    data = payload.model_dump(exclude_unset=True)
    verified = data.pop("is_verified", None)
    if "question_text" in data and not (data["question_text"] or "").strip():
        raise HTTPException(status_code=400, detail="Question text cannot be empty.")
    merged = {**existing, **data}
    if merged.get("question_type") == "mcq":
        filled = {key for key in "abcd" if (merged.get(f"option_{key}") or "").strip()}
        if len(filled) < 2 or merged.get("correct_answer") not in filled:
            raise HTTPException(
                status_code=400,
                detail="MCQ needs at least two options and a valid answer.",
            )
    else:
        for col in ("option_a", "option_b", "option_c", "option_d", "correct_answer"):
            data[col] = None
    if data:
        data["edited_by_admin"] = True
        if verified is None:
            verified = False
    if verified is True:
        data.update({"is_verified": True, "verified_by": admin_id, "verified_at": _now_iso()})
    elif verified is False:
        data.update({"is_verified": False, "verified_by": None, "verified_at": None})
    if not data:
        return existing

    result = (
        supabase.table("questions")
        .update(data)
        .eq("id", item_id)
        .eq("past_question_id", question_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return result.data[0]


@router.delete("/{question_id}/items/{item_id}")
async def delete_question_item(
    question_id: str,
    item_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    _check_uuid(item_id, "item id")
    result = (
        supabase.table("questions")
        .delete()
        .eq("id", item_id)
        .eq("past_question_id", question_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return {"deleted": True}


@router.post("/{question_id}/verify-all")
async def verify_all_items(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    result = (
        supabase.table("questions")
        .update({"is_verified": True, "verified_by": admin_id, "verified_at": _now_iso()})
        .eq("past_question_id", question_id)
        .execute()
    )
    return {"verified": len(result.data or [])}


@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    existing = (
        supabase.table("past_questions")
        .select("id, file_url")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    file_key = _to_key(existing.data.get("file_url", ""))
    result = supabase.table("past_questions").delete().eq("id", question_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    if file_key:
        delete_file(file_key)
    return {"deleted": True}