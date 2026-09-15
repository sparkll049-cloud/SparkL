"""
uploads.py
----------
Student-facing past-question upload feature.
Files are stored in Backblaze B2 (private bucket).
Signed URLs are generated on demand for viewing — no permanent public URLs.

Flow:
    1. Verify Supabase auth token → get real user_id
    2. Validate file size and actual file content (magic bytes)
    3. Upload to Backblaze B2 under past-questions/{user_id}/{uuid}.ext
    4. Save record with status="pending", file_url = B2 key (not a URL)
    5. Background worker handles text extraction (extraction_worker.py)
    6. Stays invisible until admin approves via /api/admin/questions
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

from app.supabase_client import supabase
from app.storage import upload_file, delete_file

router = APIRouter(prefix="/api/upload", tags=["Upload"])

TABLE_NAME     = "past_questions"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
MAX_TITLE_LENGTH = 150
MIN_YEAR = 1990

# Magic-byte signatures — never trust client Content-Type
FILE_SIGNATURES = {
    b"%PDF-":           ("application/pdf", "pdf"),
    b"\xff\xd8\xff":   ("image/jpeg",       "jpg"),
    b"\x89PNG\r\n\x1a\n": ("image/png",    "png"),
}


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
    summary="Upload a past question to Backblaze B2",
)
async def upload_past_question(
    title: str = Form(...),
    year: Optional[str] = Form(None),
    course_id: str = Form(...),
    semester_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id),
):
    # Validate title
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")
    if len(title) > MAX_TITLE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Title must be under {MAX_TITLE_LENGTH} characters.",
        )

    year = validate_year(year)

    # Validate UUIDs
    try:
        UUID(course_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid course_id.")
    if semester_id:
        try:
            UUID(semester_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid semester_id.")

    # Read file
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    # Detect real file type from magic bytes
    mime_type, ext = detect_file_type(file_bytes)

    # Upload to Backblaze B2
    storage_key = upload_file(
        file_bytes=file_bytes,
        user_id=str(user_id),
        mime_type=mime_type,
        ext=ext,
    )

    # Save record to Supabase — store B2 key not a URL
    record = {
        "title": title,
        "year": year,
        "course_id": course_id,
        "semester_id": semester_id,
        "status": "pending",
        "file_url": storage_key,
        "mime_type": mime_type,
        "file_size": len(file_bytes),
        "extracted_text": None,
        "extraction_quality": None,
        "uploaded_by": str(user_id),
    }

    try:
        response = supabase.table(TABLE_NAME).insert(record).execute()
    except Exception:
        # Clean up orphaned B2 file if DB insert fails
        delete_file(storage_key)
        raise HTTPException(status_code=500, detail="Failed to save upload.")

    if not response.data:
        delete_file(storage_key)
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