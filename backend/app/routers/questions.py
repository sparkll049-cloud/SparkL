"""
questions.py
------------
Public-facing single past-question detail view. File access is never
returned as a direct link — the bucket is private, so the frontend must
call the /file-url endpoint to get a short-lived signed URL on demand.

Admins can view any file (pending, rejected, or approved) for review
purposes; regular users can only view their own uploads or approved ones.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.supabase_client import supabase
from app.routers.uploads import get_current_user_id

router = APIRouter(prefix="/api/questions", tags=["Questions"])

STORAGE_BUCKET = "past-questions"
FILE_URL_EXPIRY_SECONDS = 90  # long enough to load the viewer, not to hoard


def _is_admin(user_id: UUID) -> bool:
    """Soft admin check — returns False on any lookup failure instead of
    raising, since this is used as an access bypass, not a hard gate."""
    try:
        profile_res = (
            supabase.table("profiles")
            .select("is_admin")
            .eq("id", str(user_id))
            .single()
            .execute()
        )
        profile = profile_res.data
        return bool(profile and profile.get("is_admin"))
    except Exception:
        return False


def _can_access(row: dict, user_id: UUID) -> bool:
    if row["status"] == "approved":
        return True
    if row["uploaded_by"] == str(user_id):
        return True
    return _is_admin(user_id)


@router.get("/{question_id}")
async def get_question(question_id: str, user_id: UUID = Depends(get_current_user_id)):
    try:
        UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid question id.")

    response = (
        supabase.table("past_questions")
        .select(
            "id, title, year, status, extracted_text, extraction_quality, "
            "mime_type, created_at, uploaded_by, "
            "course:courses(id, name), semester:semesters(id, name)"
        )
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )

    row = response.data
    if not row:
        raise HTTPException(status_code=404, detail="Question not found.")

    if not _can_access(row, user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    return row


@router.get("/{question_id}/file-url")
async def get_signed_file_url(
    question_id: str, user_id: UUID = Depends(get_current_user_id)
):
    try:
        UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid question id.")

    response = (
        supabase.table("past_questions")
        .select("file_url, status, uploaded_by")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    row = response.data
    if not row:
        raise HTTPException(status_code=404, detail="Question not found.")

    if not _can_access(row, user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    try:
        signed = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
            row["file_url"], FILE_URL_EXPIRY_SECONDS
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate file link.")

    return {"url": signed["signedURL"], "expires_in": FILE_URL_EXPIRY_SECONDS}