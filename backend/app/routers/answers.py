"""
answers.py
----------
Student-facing answer submission for past questions. Students upload a
photo/scan of their handwritten answer to a specific question; text is
extracted asynchronously by the same background worker used for
past_questions (see extraction_worker.py). Admins review submissions
and leave written feedback — no scoring, just review.
 
Endpoints:
    POST /api/answers                     submit an answer for a question
    GET  /api/answers/mine/{question_id}   the logged-in student's own
                                            submissions for one question
    GET  /api/admin/answers                admin: list submissions (any status)
    POST /api/admin/answers/{id}/review    admin: leave feedback, mark reviewed
"""

from __future__ import annotations

import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.supabase_client import supabase
from app.routers.uploads import get_current_user_id, detect_file_type
from app.admin_auth import get_current_admin

router = APIRouter(tags=["Answers"])

TABLE_NAME = "answer_submissions"
STORAGE_BUCKET = "answer-submissions"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB, matches past-questions limit


@router.post(
    "/api/answers",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a photo/scan answer for a past question",
)
async def submit_answer(
    question_id: str = Form(...),
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid question_id.")

    # Confirm the question exists and is actually visible to this student
    # (approved, or their own upload) before accepting an answer for it.
    question_res = (
        supabase.table("past_questions")
        .select("id, status, uploaded_by")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    question = question_res.data
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")
    if question["status"] != "approved" and question["uploaded_by"] != str(user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
        )

    mime_type, ext = detect_file_type(file_bytes)

    storage_path = f"{user_id}/{uuid.uuid4()}.{ext}"

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path, file_bytes, {"content-type": mime_type}
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to store file.")

    record = {
        "question_id": question_id,
        "submitted_by": str(user_id),
        "file_url": storage_path,
        "mime_type": mime_type,
        "file_size": len(file_bytes),
        "extracted_text": None,
        "extraction_quality": None,
        "status": "pending",
    }

    try:
        response = supabase.table(TABLE_NAME).insert(record).execute()
    except Exception:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        raise HTTPException(status_code=500, detail="Failed to save answer.")

    if not response.data:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        raise HTTPException(status_code=500, detail="Failed to save answer.")

    return response.data[0]


@router.get(
    "/api/answers/mine/{question_id}",
    summary="The logged-in student's own submissions for one question",
)
async def list_my_answers_for_question(
    question_id: str, user_id: UUID = Depends(get_current_user_id)
):
    response = (
        supabase.table(TABLE_NAME)
        .select("id, status, feedback, created_at, reviewed_at, extraction_quality")
        .eq("question_id", question_id)
        .eq("submitted_by", str(user_id))
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


@router.get(
    "/api/admin/answers",
    summary="Admin: list answer submissions, optionally filtered by status",
)
async def admin_list_answers(
    status_filter: Optional[str] = None,
    admin_id: str = Depends(get_current_admin),
):
    query = (
        supabase.table(TABLE_NAME)
        .select(
            "id, question_id, submitted_by, status, feedback, created_at, "
            "reviewed_at, extracted_text, extraction_quality, mime_type, "
            "question:past_questions(title), "
            "student:profiles!answer_submissions_submitted_by_fkey(full_name)"
        )
        .order("created_at", desc=True)
    )
    if status_filter:
        query = query.eq("status", status_filter)

    response = query.execute()
    return response.data or []


class ReviewPayload(BaseModel):
    feedback: str


@router.post(
    "/api/admin/answers/{answer_id}/review",
    summary="Admin: leave feedback and mark a submission as reviewed",
)
async def review_answer(
    answer_id: str,
    payload: ReviewPayload,
    admin_id: str = Depends(get_current_admin),
):
    try:
        UUID(answer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid answer id.")

    response = (
        supabase.table(TABLE_NAME)
        .update(
            {
                "feedback": payload.feedback.strip(),
                "status": "reviewed",
                "reviewed_at": "now()",
            }
        )
        .eq("id", answer_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Submission not found.")

    return response.data[0]


@router.get(
    "/api/answers/{answer_id}/file-url",
    summary="Get a short-lived signed URL for an answer file",
)
async def get_answer_file_url(answer_id: str, user_id: UUID = Depends(get_current_user_id)):
    response = (
        supabase.table(TABLE_NAME)
        .select("file_url, submitted_by")
        .eq("id", answer_id)
        .maybe_single()
        .execute()
    )
    row = response.data
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found.")

    is_owner = row["submitted_by"] == str(user_id)
    is_admin = False
    if not is_owner:
        profile_res = (
            supabase.table("profiles").select("is_admin").eq("id", str(user_id)).maybe_single().execute()
        )
        is_admin = bool(profile_res.data and profile_res.data.get("is_admin"))

    if not is_owner and not is_admin:
        raise HTTPException(status_code=404, detail="Submission not found.")

    try:
        signed = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(row["file_url"], 90)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate file link.")

    return {"url": signed["signedURL"], "expires_in": 90}
