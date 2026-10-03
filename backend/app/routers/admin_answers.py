"""
admin/answers.py
----------------
GET    /api/admin/answers                  — list all submissions (filter by status)
PATCH  /api/admin/answers/{id}/review      — submit feedback / re-open
DELETE /api/admin/answers/{id}             — permanently delete submission + B2 file
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.admin_auth import get_current_admin
from app.supabase_client import supabase
from app.storage import get_signed_url, delete_file

router = APIRouter(prefix="/api/admin/answers", tags=["admin-answers"])


# ── Schema ────────────────────────────────────────────────────────────────────

class ReviewPayload(BaseModel):
    feedback: Optional[str] = None
    status: str = "reviewed"  # "pending" | "reviewed"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_submissions(
    status_filter: Optional[str] = Query(None, description="pending | reviewed"),
    admin_id: str = Depends(get_current_admin),
):
    query = (
        supabase.table("answer_submissions")
        .select(
            "id, status, feedback, extracted_text, extraction_quality, "
            "mime_type, file_size, created_at, reviewed_at, "
            "question_id, submitted_by, "
            "question:past_questions(id, title, course:courses(name)), "
            "submitter:profiles(full_name, phone)"
        )
        .order("created_at", desc=True)
    )

    if status_filter in ("pending", "reviewed"):
        query = query.eq("status", status_filter)

    result = query.execute()
    return result.data or []


@router.patch("/{answer_id}/review")
async def review_submission(
    answer_id: str,
    payload: ReviewPayload,
    admin_id: str = Depends(get_current_admin),
):
    if payload.status not in ("pending", "reviewed"):
        raise HTTPException(
            status_code=422,
            detail="status must be 'pending' or 'reviewed'.",
        )

    update: dict = {"status": payload.status}

    if payload.status == "reviewed":
        if not (payload.feedback or "").strip():
            raise HTTPException(
                status_code=422,
                detail="Feedback is required when marking as reviewed.",
            )
        update["feedback"] = payload.feedback.strip()
        update["reviewed_at"] = "now()"
    else:
        # Re-opening: clear feedback + reviewed_at
        update["feedback"] = None
        update["reviewed_at"] = None

    result = (
        supabase.table("answer_submissions")
        .update(update)
        .eq("id", answer_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Submission not found.")

    return result.data[0]


@router.delete("/{answer_id}")
async def delete_submission(
    answer_id: str,
    admin_id: str = Depends(get_current_admin),
):
    # Fetch the file key before deleting
    row = (
        supabase.table("answer_submissions")
        .select("id, file_url")
        .eq("id", answer_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Submission not found.")

    # Clean up B2 file (best-effort)
    file_key = row.data.get("file_url")
    if file_key:
        try:
            await run_in_threadpool(delete_file, file_key)
        except Exception:
            pass

    supabase.table("answer_submissions").delete().eq("id", answer_id).execute()

    return {"deleted": True, "id": answer_id}