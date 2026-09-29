"""Student-facing past-question API.

Students receive metadata and structured processed questions only. The original
B2 object is intentionally never returned from this router.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.routers.uploads import get_current_user_id
from app.supabase_client import supabase

router = APIRouter(prefix="/api/questions", tags=["Questions"])


def _is_admin(user_id: UUID) -> bool:
    try:
        result = (
            supabase.table("profiles")
            .select("is_admin")
            .eq("id", str(user_id))
            .single()
            .execute()
        )
        return bool(result.data and result.data.get("is_admin"))
    except Exception:
        return False


def _can_access(row: dict, user_id: UUID) -> bool:
    if row.get("status") == "approved":
        return True
    if row.get("uploaded_by") == str(user_id):
        return True
    return _is_admin(user_id)


def _get_paper(question_id: str) -> dict:
    try:
        UUID(question_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid question id.") from exc

    response = (
        supabase.table("past_questions")
        .select("id, status, uploaded_by")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return response.data


@router.get("/{question_id}")
async def get_question(
    question_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    row = _get_paper(question_id)
    if not _can_access(row, user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    response = (
        supabase.table("past_questions")
        .select(
            "id, title, year, status, extracted_text, extraction_quality, "
            "mime_type, created_at, "
            "course:courses(id, name), semester:semesters(id, name)"
        )
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return response.data


@router.get("/{question_id}/processed")
async def get_processed_questions(
    question_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    row = _get_paper(question_id)
    if not _can_access(row, user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    response = (
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
    return response.data or []