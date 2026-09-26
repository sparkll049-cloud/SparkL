# app/routers/admin_community.py
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.supabase_client import supabase

router = APIRouter(prefix="/api/admin/community", tags=["admin-community"])


def require_admin(user_id: str = Depends(get_current_user)) -> str:
    res = (
        supabase.table("profiles")
        .select("is_admin")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not res.data or not res.data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user_id


# ── List all reports ──────────────────────────────────────────────────────────

@router.get("/reports")
async def list_reports(user_id: str = Depends(require_admin)):
    res = (
        supabase.table("community_reports")
        .select(
            "id, reason, created_at, is_reviewed, "
            "reporter:profiles!reporter_id(id, full_name), "
            "question:community_questions(id, title, is_hidden), "
            "answer:community_answers(id, content, is_hidden)"
        )
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


# ── Dismiss a report ──────────────────────────────────────────────────────────

@router.post("/reports/{report_id}/dismiss")
async def dismiss_report(report_id: str, user_id: str = Depends(require_admin)):
    res = (
        supabase.table("community_reports")
        .update({"is_reviewed": True})
        .eq("id", report_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"dismissed": True}


# ── Unhide content ────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/unhide")
async def unhide_question(question_id: str, user_id: str = Depends(require_admin)):
    supabase.table("community_questions").update(
        {"is_hidden": False}
    ).eq("id", question_id).execute()

    supabase.table("community_reports").update(
        {"is_reviewed": True}
    ).eq("question_id", question_id).execute()

    return {"unhidden": True}


@router.post("/answers/{answer_id}/unhide")
async def unhide_answer(answer_id: str, user_id: str = Depends(require_admin)):
    supabase.table("community_answers").update(
        {"is_hidden": False}
    ).eq("id", answer_id).execute()

    supabase.table("community_reports").update(
        {"is_reviewed": True}
    ).eq("answer_id", answer_id).execute()

    return {"unhidden": True}


# ── Delete flagged content ────────────────────────────────────────────────────

@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, user_id: str = Depends(require_admin)):
    supabase.table("community_questions").delete().eq("id", question_id).execute()
    return {"deleted": True}


@router.delete("/answers/{answer_id}")
async def delete_answer(answer_id: str, user_id: str = Depends(require_admin)):
    supabase.table("community_answers").delete().eq("id", answer_id).execute()
    return {"deleted": True}