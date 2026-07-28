"""
questions.py
------------
Public-facing single past-question detail view.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.supabase_client import supabase
from app.routers.uploads import get_current_user_id

router = APIRouter(prefix="/api/questions", tags=["Questions"])


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
            "file_url, mime_type, created_at, uploaded_by, "
            "course:courses(id, name), semester:semesters(id, name)"
        )
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )

    row = response.data
    if not row:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Only visible if approved, or if it's the uploader's own pending/rejected upload
    if row["status"] != "approved" and row["uploaded_by"] != str(user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    return row