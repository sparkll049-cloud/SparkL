"""
Student-facing past-question API.
Changes:
- _is_admin: removed redundant DB call — uses user dict passed from auth
- get_question: excluded extracted_text from response (not needed by students)
- _can_access: accepts pre-fetched is_admin flag instead of re-querying
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException

from app.supabase_client import supabase

router = APIRouter(prefix="/api/questions", tags=["Questions"])

PROCESSED_COLUMNS = (
    "id, question_number, question_text, question_type, "
    "option_a, option_b, option_c, option_d, "
    "correct_answer, model_answer, explanation, topic_tag, difficulty, marks"
)


# ── Auth ──────────────────────────────────────────────────────────────────────

async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> dict:
    """
    Single auth + profile fetch.
    Returns {id, is_admin, email} — no downstream re-queries needed.
    """
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

    profile = (
        supabase.table("profiles")
        .select("is_admin, admin_role")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    is_admin = False
    if profile and profile.data:
        is_admin = bool(
            profile.data.get("is_admin") or profile.data.get("admin_role")
        )

    return {
        "id":       UUID(user.id),
        "is_admin": is_admin,
        "email":    user.email or str(user.id),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _can_access(row: dict, user: dict) -> bool:
    """
    Access check using already-fetched user dict.
    No extra DB call needed.
    """
    if row.get("status") == "approved":
        return True
    if row.get("uploaded_by") == str(user["id"]):
        return True
    return user.get("is_admin", False)


def _check_uuid(value: str, label: str = "id") -> None:
    try:
        UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.") from exc


def _get_paper(question_id: str) -> dict:
    _check_uuid(question_id, "question id")
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


def _user_enrolled_in_course(user_id: UUID, course_id: str) -> bool:
    try:
        res = (
            supabase.table("user_courses")
            .select("id")
            .eq("user_id", str(user_id))
            .eq("course_id", course_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False


# ── Past-questions routes ─────────────────────────────────────────────────────

@router.get("/{question_id}")
async def get_question(
    question_id: str,
    user:        dict = Depends(get_current_user),
):
    row = _get_paper(question_id)
    if not _can_access(row, user):
        raise HTTPException(status_code=404, detail="Question not found.")

    response = (
        supabase.table("past_questions")
        .select(
            # extracted_text excluded — students don't need raw text
            "id, title, year, status, extraction_quality, "
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
    user:        dict = Depends(get_current_user),
):
    row = _get_paper(question_id)
    if not _can_access(row, user):
        raise HTTPException(status_code=404, detail="Question not found.")

    response = (
        supabase.table("questions")
        .select(PROCESSED_COLUMNS)
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )
    return response.data or []


# ── Section routes ────────────────────────────────────────────────────────────

@router.get("/section/{section_id}")
async def get_section_detail(
    section_id: str,
    user:       dict = Depends(get_current_user),
):
    _check_uuid(section_id, "section id")

    sec = (
        supabase.table("course_document_sections")
        .select(
            "id, start_page, end_page, processing_status, extraction_quality, "
            "course:courses(id, name), "
            "source_document:source_documents(id, status, page_count, created_at)"
        )
        .eq("id", section_id)
        .eq("processing_status", "ready")
        .maybe_single()
        .execute()
    )
    if not sec.data:
        raise HTTPException(status_code=404, detail="Section not found.")

    course_id = (sec.data.get("course") or {}).get("id")
    if course_id and not user["is_admin"]:
        if not _user_enrolled_in_course(user["id"], course_id):
            raise HTTPException(status_code=403, detail="Not enrolled in this course.")

    return sec.data


@router.get("/section/{section_id}/processed")
async def get_section_processed_questions(
    section_id: str,
    user:       dict = Depends(get_current_user),
):
    _check_uuid(section_id, "section id")

    sec = (
        supabase.table("course_document_sections")
        .select("id, processing_status, course_id")
        .eq("id", section_id)
        .maybe_single()
        .execute()
    )
    if not sec.data:
        raise HTTPException(status_code=404, detail="Section not found.")
    if sec.data.get("processing_status") not in ("ready", "approved"):
        raise HTTPException(status_code=404, detail="Section not ready yet.")

    course_id = sec.data.get("course_id")
    if course_id and not user["is_admin"]:
        if not _user_enrolled_in_course(user["id"], course_id):
            raise HTTPException(status_code=403, detail="Not enrolled in this course.")

    response = (
        supabase.table("questions")
        .select(PROCESSED_COLUMNS)
        .eq("section_id", section_id)
        .order("question_number")
        .execute()
    )
    return response.data or []


# ── Course-level aggregation ──────────────────────────────────────────────────

@router.get("/course/{course_id}/all")
async def get_all_course_questions(
    course_id: str,
    user:      dict = Depends(get_current_user),
):
    _check_uuid(course_id, "course id")

    if not user["is_admin"]:
        if not _user_enrolled_in_course(user["id"], course_id):
            raise HTTPException(status_code=403, detail="Not enrolled in this course.")

    past_papers = (
        supabase.table("past_questions")
        .select("id")
        .eq("course_id", course_id)
        .eq("status", "approved")
        .execute()
    ).data or []

    past_questions: list[dict] = []
    if past_papers:
        paper_ids = [p["id"] for p in past_papers]
        res = (
            supabase.table("questions")
            .select(PROCESSED_COLUMNS + ", past_question_id, section_id")
            .in_("past_question_id", paper_ids)
            .order("question_number")
            .execute()
        )
        for q in (res.data or []):
            q["source"] = "past_question"
        past_questions = res.data or []

    sections = (
        supabase.table("course_document_sections")
        .select("id")
        .eq("course_id", course_id)
        .in_("processing_status", ["ready", "approved"])
        .execute()
    ).data or []

    section_questions: list[dict] = []
    if sections:
        section_ids = [s["id"] for s in sections]
        res = (
            supabase.table("questions")
            .select(PROCESSED_COLUMNS + ", past_question_id, section_id")
            .in_("section_id", section_ids)
            .order("question_number")
            .execute()
        )
        for q in (res.data or []):
            q["source"] = "section"
        section_questions = res.data or []

    all_questions = past_questions + section_questions
    return {
        "course_id": course_id,
        "total":     len(all_questions),
        "questions": all_questions,
    }