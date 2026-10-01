"""Student-facing past-question API.

Students receive metadata and structured processed questions only. The original
B2 object is intentionally never returned from this router.

Supports two question sources:
  - past_questions  (single-upload flow)  — accessed via /api/questions/{question_id}
  - course_document_sections (multi-course PDF flow) — accessed via /api/questions/section/{section_id}
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.routers.uploads import get_current_user_id
from app.supabase_client import supabase

router = APIRouter(prefix="/api/questions", tags=["Questions"])

PROCESSED_COLUMNS = (
    "id, question_number, question_text, question_type, "
    "option_a, option_b, option_c, option_d, "
    "correct_answer, model_answer, explanation, topic_tag, difficulty, marks"
)


# ── Helpers ───────────────────────────────────────────────────────────────────

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
    """Check the user is enrolled in the course the section belongs to."""
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


# ── Past-questions (single-upload) routes ─────────────────────────────────────

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
    """
    Returns processed questions for a past_questions record.
    Fetches questions that have this past_question_id — covers the single-upload flow.
    """
    row = _get_paper(question_id)
    if not _can_access(row, user_id):
        raise HTTPException(status_code=404, detail="Question not found.")

    response = (
        supabase.table("questions")
        .select(PROCESSED_COLUMNS)
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )
    return response.data or []


# ── Section (multi-course PDF) routes ─────────────────────────────────────────

@router.get("/section/{section_id}")
async def get_section_detail(
    section_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Returns metadata for a course_document_sections record.
    Used by the course viewer to show section title, page range, course info.
    """
    _check_uuid(section_id, "section id")

    sec = (
        supabase.table("course_document_sections")
        .select(
            "id, start_page, end_page, processing_status, extraction_quality, "
            "course:courses(id, name), "
            "source_document:source_documents(id, status, page_count, created_at)"
        )
        .eq("id", section_id)
        .eq("processing_status", "ready")   # only expose ready sections
        .maybe_single()
        .execute()
    )
    if not sec.data:
        raise HTTPException(status_code=404, detail="Section not found.")

    # Verify user is enrolled in this course (or is admin)
    course_id = (sec.data.get("course") or {}).get("id")
    if course_id and not _is_admin(user_id):
        if not _user_enrolled_in_course(user_id, course_id):
            raise HTTPException(status_code=403, detail="Not enrolled in this course.")

    return sec.data


@router.get("/section/{section_id}/processed")
async def get_section_processed_questions(
    section_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Returns all processed questions for a section (multi-course PDF flow).
    Only returns questions from approved/ready sections.
    """
    _check_uuid(section_id, "section id")

    # Confirm section exists and is ready
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

    # Verify enrollment (or admin)
    course_id = sec.data.get("course_id")
    if course_id and not _is_admin(user_id):
        if not _user_enrolled_in_course(user_id, course_id):
            raise HTTPException(status_code=403, detail="Not enrolled in this course.")

    response = (
        supabase.table("questions")
        .select(PROCESSED_COLUMNS)
        .eq("section_id", section_id)
        .order("question_number")
        .execute()
    )
    return response.data or []


# ── Course-level aggregation ───────────────────────────────────────────────────

@router.get("/course/{course_id}/all")
async def get_all_course_questions(
    course_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Returns ALL processed questions for a course — both flows combined.
    Used by the course viewer / practice mode to show everything in one list.

    Sources:
      1. past_questions → questions (via past_question_id)
      2. course_document_sections → questions (via section_id)
    """
    _check_uuid(course_id, "course id")

    # Enrollment check
    if not _is_admin(user_id):
        if not _user_enrolled_in_course(user_id, course_id):
            raise HTTPException(status_code=403, detail="Not enrolled in this course.")

    # ── Source 1: single-upload past questions ────────────────────────────────
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

    # ── Source 2: multi-course PDF sections ───────────────────────────────────
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
        "course_id":  course_id,
        "total":      len(all_questions),
        "questions":  all_questions,
    }
