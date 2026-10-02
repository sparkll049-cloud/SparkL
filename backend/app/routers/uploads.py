# app/routers/uploads.py
from __future__ import annotations

import hashlib
import logging
import os
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

import httpx
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

router = APIRouter(prefix="/api/upload", tags=["Upload"])

logger = logging.getLogger("uploads")

TABLE_NAME       = "past_questions"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_TITLE_LENGTH = 150
MIN_YEAR         = 1990
CONSENT_VERSION  = "2026-09"

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO  = os.getenv("GITHUB_REPO", "sparkll049-cloud/SparkL.git")

FILE_SIGNATURES = {
    b"%PDF-":               ("application/pdf", "pdf"),
    b"\xff\xd8\xff":        ("image/jpeg",      "jpg"),
    b"\x89PNG\r\n\x1a\n":  ("image/png",       "png"),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def _load_course_context(course_id: str) -> tuple[str, str]:
    try:
        res = (
            supabase.table("courses")
            .select("name, department:departments(institution:institutions(name))")
            .eq("id", course_id)
            .limit(1)
            .execute()
        )
        row = (res.data or [None])[0] or {}
        course_name = row.get("name") or ""
        dept = row.get("department") or {}
        inst = dept.get("institution") or {}
        return course_name, inst.get("name") or ""
    except Exception:
        return "", ""


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


async def trigger_github_extraction(
    record_id: str,
    file_key: str,
    mime_type: str,
    course_name: str = "",
    institution: str = "",
):
    if not GITHUB_TOKEN:
        logger.warning("GITHUB_TOKEN not set — skipping GitHub trigger")
        return
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/extract.yml/dispatches",
                headers={
                    "Authorization": f"Bearer {GITHUB_TOKEN}",
                    "Accept": "application/vnd.github+json",
                },
                json={
                    "ref": "main",
                    "inputs": {
                        "record_id":   record_id,
                        "file_key":    file_key,
                        "mime_type":   mime_type,
                        "course_name": course_name,
                        "institution": institution,
                    },
                },
                timeout=10,
            )
            if res.status_code != 204:
                logger.error("GitHub trigger failed: %s %s", res.status_code, res.text)
            else:
                logger.info("GitHub extraction triggered for %s", record_id)
    except Exception as e:
        logger.error("GitHub trigger error: %s", e)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a single-course past question",
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
    if not declaration_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the upload declaration.",
        )

    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")
    if len(title) > MAX_TITLE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Title must be under {MAX_TITLE_LENGTH} characters.",
        )

    year = validate_year(year)

    validate_uuid(course_id, "course_id")
    if semester_id:
        validate_uuid(semester_id, "semester_id")
    if level_id:
        validate_uuid(level_id, "level_id")

    if not await run_in_threadpool(_course_exists, course_id):
        raise HTTPException(status_code=400, detail="Course not found.")

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

    mime_type, ext = detect_file_type(file_bytes)

    file_hash = hashlib.sha256(file_bytes).hexdigest()
    duplicate = await run_in_threadpool(_find_duplicate, file_hash)
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This file has already been uploaded"
                f" (\"{duplicate['title']}\"). Thanks for contributing!"
            ),
        )

    storage_key = await run_in_threadpool(
        lambda: upload_file(
            file_bytes=file_bytes,
            user_id=str(user_id),
            mime_type=mime_type,
            ext=ext,
        )
    )

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
        "extracted_text":     None,
        "extraction_quality": None,
        "uploaded_by":        str(user_id),
        "consent_at":         datetime.now(timezone.utc).isoformat(),
        "consent_version":    CONSENT_VERSION,
    }

    try:
        response = await run_in_threadpool(
            lambda: supabase.table(TABLE_NAME).insert(record).execute()
        )
    except Exception as exc:
        await run_in_threadpool(delete_file, storage_key)
        if _is_duplicate_error(exc):
            raise HTTPException(
                status_code=409,
                detail="This file has already been uploaded.",
            )
        raise HTTPException(status_code=500, detail="Failed to save upload.")

    if not response.data:
        await run_in_threadpool(delete_file, storage_key)
        raise HTTPException(status_code=500, detail="Failed to save upload.")

    inserted = response.data[0]
    record_id = inserted["id"]

    # Load course context for GitHub worker
    course_name, institution = await run_in_threadpool(_load_course_context, course_id)

    # Trigger GitHub Actions — fire and forget
    import asyncio
    asyncio.create_task(trigger_github_extraction(
        record_id=record_id,
        file_key=storage_key,
        mime_type=mime_type,
        course_name=course_name,
        institution=institution,
    ))

    return inserted


@router.get(
    "/mine",
    summary="The logged-in user's own uploads",
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


@router.post(
    "/{question_id}/retry",
    summary="Re-queue a failed single-course upload for processing",
)
async def retry_upload_processing(
    question_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid question id.")

    row = (
        supabase.table(TABLE_NAME)
        .select("id, uploaded_by, processing_status, file_url, mime_type, course_id")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found.")
    if row["uploaded_by"] != str(user_id):
        raise HTTPException(status_code=403, detail="Not your upload.")

    supabase.table(TABLE_NAME).update(
        {"processing_status": "uploaded", "processing_error": None}
    ).eq("id", question_id).execute()

    # Re-trigger GitHub extraction
    course_name, institution = await run_in_threadpool(
        _load_course_context, row["course_id"]
    )
    import asyncio
    asyncio.create_task(trigger_github_extraction(
        record_id=question_id,
        file_key=row["file_url"],
        mime_type=row["mime_type"],
        course_name=course_name,
        institution=institution,
    ))

    return {"ok": True}