"""
answers.py
----------
Student-facing answer submission routes.

POST /api/answers/submit        — student submits solution (text + optional file)
GET  /api/answers/{id}/file-url — admin gets a short-lived signed URL to view the file
"""
from __future__ import annotations

import io
import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.supabase_client import supabase
from app.storage import upload_bytes, get_signed_url

router = APIRouter(prefix="/api/answers", tags=["Answers"])

SIGNED_URL_TTL   = 300          # 5 minutes — admin preview only
MAX_FILE_SIZE    = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIMES    = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
}
ANSWER_FOLDER    = "answer-submissions"   # B2 folder prefix


# ── Auth helpers ──────────────────────────────────────────────────────────────

async def get_current_user_id(
    authorization: Optional[str] = Header(None),
) -> UUID:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user = getattr(resp, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return UUID(user.id)


async def get_current_admin(
    authorization: Optional[str] = Header(None),
) -> UUID:
    user_id = await get_current_user_id(authorization)
    result = (
        supabase.table("profiles")
        .select("is_admin, admin_role")
        .eq("id", str(user_id))
        .single()
        .execute()
    )
    is_admin = bool(
        result.data and (result.data.get("is_admin") or result.data.get("admin_role"))
    )
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user_id


# ── Upload helper ─────────────────────────────────────────────────────────────

def _upload_answer_file(file_bytes: bytes, mime_type: str, submission_id: str) -> str:
    """Upload to B2 and return the storage key."""
    ext = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
    }.get(mime_type, "bin")

    key = f"{ANSWER_FOLDER}/{submission_id}.{ext}"
    upload_bytes(key, file_bytes, content_type=mime_type)
    return key


# ── OCR helper (best-effort) ──────────────────────────────────────────────────

def _try_extract_text(file_bytes: bytes, mime_type: str) -> tuple[str | None, float | None]:
    """
    Run OCR on the uploaded file. Returns (text, quality) or (None, None) on failure.
    Quality is a rough 0-1 confidence estimate based on character count.
    """
    try:
        if mime_type == "application/pdf":
            import pypdfium2 as pdfium
            from PIL import Image
            import pytesseract

            pdf   = pdfium.PdfDocument(file_bytes)
            texts = []
            for i in range(len(pdf)):
                page   = pdf[i]
                bitmap = page.render(scale=2.0)
                img    = bitmap.to_pil()
                texts.append(pytesseract.image_to_string(img))
            full_text = "\n\n".join(texts).strip()

        else:
            from PIL import Image
            import pytesseract

            img       = Image.open(io.BytesIO(file_bytes))
            full_text = pytesseract.image_to_string(img).strip()

        if not full_text:
            return None, 0.0

        # Rough quality: penalise very short or garbled text
        quality = min(1.0, len(full_text) / 500)
        return full_text, round(quality, 3)

    except Exception:
        return None, None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/submit", summary="Student submits a solution for a past question")
async def submit_answer(
    question_id:   str           = Form(...),
    solution_text: Optional[str] = Form(None),
    file:          Optional[UploadFile] = File(None),
    user_id: UUID = Depends(get_current_user_id),
):
    # Validate question exists and is approved
    q = (
        supabase.table("past_questions")
        .select("id, status")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not q.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    if q.data.get("status") != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    text = (solution_text or "").strip() or None

    # Must have at least text or file
    if not text and not file:
        raise HTTPException(
            status_code=422, detail="Please provide a solution (text or file)."
        )

    submission_id = str(uuid.uuid4())
    file_url      = None
    mime_type     = None
    file_size     = None
    extracted_text  = None
    extraction_quality = None

    # Handle file upload
    if file and file.filename:
        mime_type = file.content_type or "application/octet-stream"
        if mime_type not in ALLOWED_MIMES:
            raise HTTPException(
                status_code=415,
                detail="Only PDF, JPEG, PNG, WEBP, and HEIC files are accepted.",
            )

        file_bytes = await file.read()
        file_size  = len(file_bytes)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File too large. Maximum size is 10 MB.",
            )

        # Upload to B2
        file_url = await run_in_threadpool(
            _upload_answer_file, file_bytes, mime_type, submission_id
        )

        # OCR in background (best-effort, don't fail submission if it errors)
        extracted_text, extraction_quality = await run_in_threadpool(
            _try_extract_text, file_bytes, mime_type
        )

    # Insert into Supabase
    row = {
        "id":                  submission_id,
        "question_id":         question_id,
        "submitted_by":        str(user_id),
        "status":              "pending",
        "feedback":            None,
        "file_url":            file_url,
        "mime_type":           mime_type,
        "file_size":           file_size,
        "extracted_text":      extracted_text or text,   # prefer OCR, fall back to typed text
        "extraction_quality":  extraction_quality,
        "is_hidden":           False,
    }

    result = supabase.table("answer_submissions").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save submission.")

    return {"id": submission_id, "status": "pending"}


@router.get(
    "/{answer_id}/file-url",
    summary="Admin: get a short-lived signed URL to view the submitted file",
)
async def get_answer_file_url(
    answer_id: str,
    _admin: UUID = Depends(get_current_admin),
):
    row = (
        supabase.table("answer_submissions")
        .select("file_url, mime_type")
        .eq("id", answer_id)
        .maybe_single()
        .execute()
    )
    if not row.data or not row.data.get("file_url"):
        raise HTTPException(status_code=404, detail="No file attached to this submission.")

    signed_url = await run_in_threadpool(
        get_signed_url, row.data["file_url"], SIGNED_URL_TTL
    )
    return {"url": signed_url, "mime_type": row.data.get("mime_type")}
