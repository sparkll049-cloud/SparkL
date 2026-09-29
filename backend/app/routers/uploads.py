"""
uploads.py
----------
Student-facing past-question upload feature.
Files are stored in Backblaze B2 (private bucket).
Signed URLs are generated on demand for viewing — no permanent public URLs.

Flow:
    1. Verify Supabase auth token → get real user_id
    2. Require the upload declaration (stored with a timestamp)
    3. Validate file size and actual file content (magic bytes)
    4. Hash the file → reject duplicates before spending any extraction calls
    5. Pre-extract text NOW — reject file immediately if completely unreadable
    6. Upload to Backblaze B2 under past-questions/{user_id}/{uuid}.ext
    7. Save record (processing_status = 'uploaded'); extracted_text is already
       populated, or None if Gemini was rate-limited — worker retries later
    8. Stays invisible until admin approves via /api/admin/questions
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool

from app.supabase_client import supabase
from app.storage import upload_file, delete_file
from app.services.text_extractor import (
    extract_text,
    EmptyExtractionError,
    UnsupportedFileTypeError,
)

router = APIRouter(prefix="/api/upload", tags=["Upload"])

TABLE_NAME       = "past_questions"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
MAX_TITLE_LENGTH = 150
MIN_YEAR         = 1990
CONSENT_VERSION  = "2026-09"  # bump when the upload declaration text changes

# Magic-byte signatures — never trust client Content-Type
FILE_SIGNATURES = {
    b"%PDF-":               ("application/pdf", "pdf"),
    b"\xff\xd8\xff":       ("image/jpeg",       "jpg"),
    b"\x89PNG\r\n\x1a\n": ("image/png",        "png"),
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def detect_file_type(file_bytes: bytes) -> tuple[str, str]:
    for signature, (mime_type, ext) in FILE_SIGNATURES.items():
        if file_bytes.startswith(signature):
            return mime_type, ext
    raise HTTPException(
        status_code=415,
        detail="Only PDF, JPG, and PNG files are allowed.",
    )


def validate_year(year: Optional[str]) -> Optional[str]:
    if not year:
        return None
    if not year.isdigit() or len(year) != 4:
        raise HTTPException(status_code=400, detail="Year must be a 4-digit number.")
    year_int = int(year)
    current_year = date.today().year
    if year_int < MIN_YEAR or year_int > current_year + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Year must be between {MIN_YEAR} and {current_year + 1}.",
        )
    return year


def validate_uuid(value: str, field: str) -> None:
    try:
        UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field}.")


def _is_duplicate_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "23505" in msg or "duplicate key" in msg


def _find_duplicate(file_hash: str) -> Optional[dict]:
    res = (
        supabase.table(TABLE_NAME)
        .select("id, title, status")
        .eq("file_hash", file_hash)
        .neq("status", "rejected")
        .limit(1)
        .execute()
    )
    rows = res.data if res else None
    return rows[0] if rows else None


def _course_exists(course_id: str) -> bool:
    res = (
        supabase.table("courses")
        .select("id")
        .eq("id", course_id)
        .limit(1)
        .execute()
    )
    return bool(res and res.data)


async def get_current_user_id(
    authorization: Optional[str] = Header(None),
) -> UUID:
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
    return UUID(user.id)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a past question — dedupes, pre-extracts text, rejects unreadable files",
)
async def upload_past_question(
    title: str = Form(...),
    year: Optional[str] = Form(None),
    course_id: str = Form(...),
    semester_id: Optional[str] = Form(None),
    level_id: Optional[str] = Form(None),
    declaration_accepted: bool = Form(False),
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id),
):
    # ── Consent ───────────────────────────────────────────────────────
    if not declaration_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the upload declaration.",
        )

    # ── Validate title ────────────────────────────────────────────────
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")
    if len(title) > MAX_TITLE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Title must be under {MAX_TITLE_LENGTH} characters.",
        )

    year = validate_year(year)

    # ── Validate ids ──────────────────────────────────────────────────
    validate_uuid(course_id, "course_id")
    if semester_id:
        validate_uuid(semester_id, "semester_id")
    if level_id:
        validate_uuid(level_id, "level_id")

    if not await run_in_threadpool(_course_exists, course_id):
        raise HTTPException(status_code=400, detail="Course not found.")

    # ── Read and size-check file ──────────────────────────────────────
    declared_size = getattr(file, "size", None)
    if declared_size and declared_size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    # ── Detect real file type from magic bytes ────────────────────────
    mime_type, ext = detect_file_type(file_bytes)

    # ── Duplicate check (before any paid extraction calls) ────────────
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    duplicate = await run_in_threadpool(_find_duplicate, file_hash)
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                "This file has already been uploaded"
                f" (\"{duplicate['title']}\"). Thanks for contributing!"
            ),
        )

    # ── Pre-extraction check ──────────────────────────────────────────
    # Reject completely unreadable files immediately with a clear message
    # so the student can fix it rather than wasting admin review time.
    pre_extract_text    = None
    pre_extract_quality = None

    fake_filename = f"file.{ext}"

    try:
        pre_result          = await run_in_threadpool(extract_text, fake_filename, file_bytes)
        pre_extract_text    = pre_result.text
        pre_extract_quality = pre_result.quality

    except EmptyExtractionError as e:
        raise HTTPException(
            status_code=422,
            detail=(
                f"We couldn't read text from your file: {str(e)} "
                "Please upload a clearer scan or a text-based PDF."
            ),
        )

    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=415, detail=str(e))

    except Exception:
        # Gemini may be rate-limited or unavailable — don't block the upload.
        # The background worker will retry extraction later.
        pre_extract_text    = None
        pre_extract_quality = None

    # ── Upload to Backblaze B2 ────────────────────────────────────────
    storage_key = await run_in_threadpool(
        lambda: upload_file(
            file_bytes=file_bytes,
            user_id=str(user_id),
            mime_type=mime_type,
            ext=ext,
        )
    )

    # ── Save record to Supabase ───────────────────────────────────────
    # Store B2 key as file_url — never a permanent public URL.
    # Actual file access always goes through a short-lived signed URL
    # generated on demand via /api/questions/{id}/file-url.
    record = {
        "title":              title,
        "year":               year,
        "course_id":          course_id,
        "semester_id":        semester_id,
        "level_id":           level_id,
        "status":             "pending",
        "processing_status":  "uploaded",
        "file_url":           storage_key,
        "file_hash":          file_hash,
        "mime_type":          mime_type,
        "file_size":          len(file_bytes),
        "extracted_text":     pre_extract_text,
        "extraction_quality": pre_extract_quality,
        "uploaded_by":        str(user_id),
        "consent_at":         datetime.now(timezone.utc).isoformat(),
        "consent_version":    CONSENT_VERSION,
    }

    try:
        response = await run_in_threadpool(
            lambda: supabase.table(TABLE_NAME).insert(record).execute()
        )
    except Exception as exc:
        # Clean up orphaned B2 file if DB insert fails
        await run_in_threadpool(delete_file, storage_key)
        if _is_duplicate_error(exc):
            # Two identical uploads raced past the check above
            raise HTTPException(
                status_code=409,
                detail="This file has already been uploaded.",
            )
        raise HTTPException(status_code=500, detail="Failed to save upload.")

    if not response.data:
        await run_in_threadpool(delete_file, storage_key)
        raise HTTPException(status_code=500, detail="Failed to save upload.")

    return response.data[0]


@router.get(
    "/mine",
    summary="The logged-in user's own uploads, any status",
)
async def list_my_uploads(user_id: UUID = Depends(get_current_user_id)):
    def _query():
        return (
            supabase.table(TABLE_NAME)
            .select(
                "id, title, year, status, processing_status, created_at, "
                "rejection_reason, extraction_quality, "
                "course:courses(name), "
                "semester:semesters(name)"
            )
            .eq("uploaded_by", str(user_id))
            .order("created_at", desc=True)
            .execute()
        )

    response = await run_in_threadpool(_query)
    return response.data or []
