from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.admin_auth import get_current_admin
from app.supabase_client import supabase

router = APIRouter(prefix="/api/admin/questions", tags=["admin-questions"])


class StatusUpdate(BaseModel):
    status: str  # "pending" | "approved" | "rejected"


@router.get("")
async def list_questions(
    status: str = None,
    admin_id: str = Depends(get_current_admin),
):
    query = supabase.table("past_questions").select(
        "id, title, year, status, created_at, file_url, extracted_text, "
        "course:courses(name), "
        "uploader:profiles!past_questions_uploaded_by_profiles_fkey(full_name)"
    )

    if status:
        query = query.eq("status", status)

    res = query.order("created_at", desc=True).execute()
    return res.data


@router.patch("/{question_id}/status")
async def update_question_status(
    question_id: str,
    payload: StatusUpdate,
    admin_id: str = Depends(get_current_admin),
):
    if payload.status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")

    res = (
        supabase.table("past_questions")
        .update({"status": payload.status})
        .eq("id", question_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found")

    return res.data[0]


@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    supabase.table("past_questions").delete().eq("id", question_id).execute()
    return {"deleted": True}