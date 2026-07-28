from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.admin_auth import get_current_admin
from app.supabase_client import supabase

router = APIRouter(prefix="/api/admin/questions", tags=["admin-questions"])

STORAGE_BUCKET = "past-questions"


class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


@router.get("")
async def list_questions(
    status: Optional[str] = Query(None),
    admin_id: str = Depends(get_current_admin),
):
    query = (
        supabase.table("past_questions")
        .select(
            "id, title, year, status, created_at, file_url, extracted_text, "
            "rejection_reason, uploaded_by, "
            "course:courses(name), "
            "semester:semesters(name)"
        )
        .order("created_at", desc=True)
    )

    if status:
        query = query.eq("status", status)

    res = query.execute()
    questions = res.data or []

    # profiles isn't linked to past_questions via a declared FK that
    # PostgREST can see, so fetch uploaders in a second query and merge
    # them in Python rather than relying on an embedded join.
    uploader_ids = list({q["uploaded_by"] for q in questions if q.get("uploaded_by")})

    profiles_by_id = {}
    if uploader_ids:
        profiles_res = (
            supabase.table("profiles")
            .select("id, full_name")
            .in_("id", uploader_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (profiles_res.data or [])}

    for q in questions:
        profile = profiles_by_id.get(q.get("uploaded_by"))
        q["uploader"] = {"full_name": profile["full_name"]} if profile else None
        q.pop("uploaded_by", None)

    return questions


@router.patch("/{question_id}/status")
async def update_question_status(
    question_id: str,
    payload: StatusUpdate,
    admin_id: str = Depends(get_current_admin),
):
    if payload.status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid status.")

    if payload.status == "rejected" and not payload.reason:
        raise HTTPException(
            status_code=400, detail="A reason is required when rejecting."
        )

    update_data: dict = {"status": payload.status}

    if payload.status == "rejected":
        update_data["rejection_reason"] = payload.reason
    else:
        update_data["rejection_reason"] = None

    res = (
        supabase.table("past_questions")
        .update(update_data)
        .eq("id", question_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    return res.data[0]


@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    existing = (
        supabase.table("past_questions")
        .select("id, file_url")
        .eq("id", question_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    file_url = existing.data[0].get("file_url")

    res = supabase.table("past_questions").delete().eq("id", question_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Best-effort cleanup — the DB row is already gone either way, so
    # don't fail the request if storage removal has an issue.
    if file_url:
        try:
            storage_path = file_url.split(f"/{STORAGE_BUCKET}/")[-1]
            supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        except Exception:
            pass

    return {"deleted": True}