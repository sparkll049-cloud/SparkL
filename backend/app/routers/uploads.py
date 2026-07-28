"""
uploads.py
----------
Student-facing past-question upload feature. Matches the real
`past_questions` table schema: id, course_id, uploaded_by, title, year,
file_url, extracted_text, extraction_quality, status, created_at,
semester_id, file_size, mime_type, rejection_reason.

Row Level Security is already enabled on this table in Supabase, with
policies enforcing that users can only insert/read their own uploads
(plus separate admin and "approved" read policies) — this code relies on
that as a second layer of defense, not as a replacement for it.

Flow on upload:
    1. Verify the caller's Supabase auth token -> get a real user_id
    2. Validate file size and actual file content (not just the
       client-supplied Content-Type, which can be spoofed)
    3. Upload the raw file to Supabase Storage under a per-user path
       with a random filename -> store the storage PATH (not a public
       URL — the bucket is private, so file access always goes through
       a short-lived signed URL generated on demand, never a permanent
       link)
    4. Extract text from the file (OCR if it's an image/scanned PDF)
       and score how trustworthy that extraction looks
    5. Save the record with status="pending" — it stays invisible to
       other students until an admin approves it via /api/admin/questions

Endpoints:
    POST /api/upload         upload a file -> store -> extract -> save (pending)
    GET  /api/upload/mine    the logged-in user's own uploads, any status
"""

from __future__ import annotations

import uuid
from datetime import date
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
from app.services.text_extractor import (
    EmptyExtractionError,
    UnsupportedFileTypeError,
    extract_text,
)
from app.services.text_quality import estimate_extraction_quality

router = APIRouter(prefix="/api/upload", tags=["Upload"])

TABLE_NAME = "past_questions"
STORAGE_BUCKET = "past-questions"  # must exist in Supabase Storage, PRIVATE

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB, matches frontend + bucket limit
MAX_TITLE_LENGTH = 150
MIN_YEAR = 1990

# Magic-byte signatures — checked against actual file content, not the
# client-supplied Content-Type header, which is trivial to spoof.
FILE_SIGNATURES = {
    b"%PDF-": ("application/pdf", "pdf"),
    b"\xff\xd8\xff": ("image/jpeg", "jpg"),
    b"\x89PNG\r\n\x1a\n": ("image/png", "png"),
}


def detect_file_type(file_bytes: bytes) -> tuple[str, str]:
    """Return (mime_type, extension) based on real file content, or raise
    if the bytes don't match an allowed signature."""
    for signature, (mime_type, ext) in FILE_SIGNATURES.items():
        if file_bytes.startswith(signature):
            return mime_type, ext
    raise HTTPException(
        status_code=415,
        detail="Only PDF, JPG, and PNG files are allowed.",
    )


def validate_year(year: Optional[str]) -> Optional[str]:
    """Reject anything that isn't a plausible 4-digit year. year is
    optional, so None/empty just passes through."""
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


# ---------------------------------------------------------------------------
# Auth — verifies the Supabase JWT sent by the frontend and returns the
# real, server-verified user id. Nothing here trusts client-supplied ids.
# ---------------------------------------------------------------------------
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


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a past question — file is stored, text extracted, saved as pending",
)
async def upload_past_question(
    title: str = Form(...),
    year: Optional[str] = Form(None),
    course_id: str = Form(...),
    semester_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id),
):
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")
    if len(title) > MAX_TITLE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Title must be under {MAX_TITLE_LENGTH} characters.",
        )

    year = validate_year(year)

    # Reject obviously invalid ids early rather than trusting them blindly.
    try:
        UUID(course_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid course_id.")
    if semester_id:
        try:
            UUID(semester_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid semester_id.")

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    # Trust the bytes, not the client's declared filename/content-type.
    mime_type, ext = detect_file_type(file_bytes)

    # OCR/PDF parsing is CPU-bound and blocking — run it off the event loop
    # so one big scanned PDF doesn't stall every other request.
    try:
        result = await run_in_threadpool(extract_text, file.filename, file_bytes)
    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=415, detail=str(e)) from e
    except EmptyExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # Heuristic score for how trustworthy the extraction looks — not a
    # real OCR confidence value, just enough to flag obviously garbled
    # text for admin review / student awareness.
    extraction_quality = estimate_extraction_quality(result.text)

    # Random filename under the caller's own user_id folder — never the
    # client-supplied filename. This also matches the storage.objects
    # policy that restricts uploads to path <auth.uid()>/... only.
    storage_path = f"{user_id}/{uuid.uuid4()}.{ext}"

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path,
            file_bytes,
            {"content-type": mime_type},
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to store file.")

    # The bucket is private now — we store only the internal path, never
    # a permanent public URL. Actual file access always goes through a
    # short-lived signed URL generated on demand (see questions.py).
    file_url = storage_path

    record = {
        "title": title,
        "year": year,
        "course_id": course_id,
        "semester_id": semester_id,
        "status": "pending",
        "file_url": file_url,
        "mime_type": mime_type,
        "file_size": len(file_bytes),
        "extracted_text": result.text,
        "extraction_quality": extraction_quality,
        "uploaded_by": str(user_id),
    }

    try:
        response = supabase.table(TABLE_NAME).insert(record).execute()
    except Exception:
        # Insert call itself blew up (network blip, etc.) — clean up the
        # orphaned file rather than leaving it dangling in storage.
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        raise HTTPException(status_code=500, detail="Failed to save upload.")

    if not response.data:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        raise HTTPException(status_code=500, detail="Failed to save upload.")

    return response.data[0]


@router.get(
    "/mine",
    summary="The logged-in user's own uploads, any status",
)
async def list_my_uploads(user_id: UUID = Depends(get_current_user_id)):
    response = (
        supabase.table(TABLE_NAME)
        .select(
            "id, title, year, status, created_at, rejection_reason, "
            "extraction_quality, "
            "course:courses(name), "
            "semester:semesters(name)"
        )
        .eq("uploaded_by", str(user_id))
        .order("created_at", desc=True)
        .execute()
    )

    return response.data or []
