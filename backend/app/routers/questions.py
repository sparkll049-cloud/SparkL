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
from app.storage import get_signed_url

router = APIRouter(prefix="/api/questions", tags=["Questions"])

FILE_URL_EXPIRY_SECONDS = 90


def _is_admin(user_id: UUID) -> bool:
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
async def get_question(
    question_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
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
    question_id: str,
    user_id: UUID = Depends(get_current_user_id),
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

    url = get_signed_url(row["file_url"], expires_in=FILE_URL_EXPIRY_SECONDS)

    return {"url": url, "expires_in": FILE_URL_EXPIRY_SECONDS}


@router.get("/{question_id}/processed")
async def get_processed_questions(
    question_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid question id.")

    # Verify access first
    response = (
        supabase.table("past_questions")
        .select("id, status, uploaded_by")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )

    row = response.data
    if not row:
        raise HTTPException(status_code=404, detail="Question not found.")

    if not _can_access(row, user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    res = (
        supabase.table("questions")
        .select(
            "id, question_number, question_text, question_type, "
            "option_a, option_b, option_c, option_d, "
            "correct_answer, model_answer, explanation, topic_tag, difficulty, marks"
        )
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )

    return res.data or []