"""
Student-facing past-question API + AI quiz generation.
"""
from __future__ import annotations

import json
import re
from typing import Literal, Optional
from uuid import UUID

import google.generativeai as genai
from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.supabase_client import supabase
from app.config import settings  # expects settings.GEMINI_API_KEY

router = APIRouter(prefix="/api/questions", tags=["Questions"])

PROCESSED_COLUMNS = (
    "id, question_number, question_text, question_type, "
    "option_a, option_b, option_c, option_d, "
    "correct_answer, model_answer, explanation, topic_tag, difficulty, marks"
)

# ── Configure Gemini ───────────────────────────────────────────────────────────

genai.configure(api_key=settings.GEMINI_API_KEY)

GEMINI_MODEL = "gemini-3.1-flash-lite"  # stable since May 2026, fast + cheap


# ── Auth ───────────────────────────────────────────────────────────────────────

async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> dict:
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


# ── Helpers ────────────────────────────────────────────────────────────────────

def _can_access(row: dict, user: dict) -> bool:
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


# ── Safe Supabase query helper ─────────────────────────────────────────────────

class _EmptyResult:
    data = []
    count = 0

def _safe(fn):
    """Call fn() which should return a Supabase result; return _EmptyResult on any error."""
    try:
        return fn()
    except Exception as exc:
        print(f"[supabase] query failed (returning empty): {exc}")
        return _EmptyResult()


# ── Quiz: helpers ──────────────────────────────────────────────────────────────

def _get_paper_text(question_id: str) -> tuple[str, str]:
    """
    Returns (paper_title, source_text) for the given past question.
    source_text is built from extracted_text + any processed questions.
    """
    paper_res = (
        supabase.table("past_questions")
        .select("id, title, extracted_text, status, uploaded_by")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not paper_res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    row = paper_res.data
    title = row.get("title", "Past Question Paper")
    extracted = (row.get("extracted_text") or "").strip()

    processed_res = (
        supabase.table("questions")
        .select(
            "question_number, question_text, option_a, option_b, option_c, option_d, "
            "correct_answer, explanation, topic_tag"
        )
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )
    processed = processed_res.data or []

    processed_text = ""
    if processed:
        lines = []
        for q in processed:
            lines.append(f"Q{q['question_number']}: {q['question_text']}")
            for opt in ["a", "b", "c", "d"]:
                val = q.get(f"option_{opt}")
                if val:
                    lines.append(f"  ({opt.upper()}) {val}")
            if q.get("correct_answer"):
                lines.append(f"  Answer: {q['correct_answer'].upper()}")
            if q.get("explanation"):
                lines.append(f"  Explanation: {q['explanation']}")
        processed_text = "\n".join(lines)

    source_text = "\n\n".join(filter(None, [extracted, processed_text]))
    if not source_text:
        raise HTTPException(
            status_code=422,
            detail="This paper has no extractable content yet. Try again after processing.",
        )

    return title, source_text


DIFFICULTY_INSTRUCTIONS = {
    "easy": (
        "Generate EASY questions — straightforward recall of definitions, basic facts, "
        "and fundamental concepts. A student who read the material once should get most right."
    ),
    "medium": (
        "Generate MEDIUM difficulty questions — exam-level challenge. Mix direct recall with "
        "application and understanding. Typical of what appears in Nigerian university exams."
    ),
    "hard": (
        "Generate HARD questions — analytical, tricky distractors, multi-step reasoning. "
        "Push the student to think critically. Some questions should combine concepts."
    ),
}


def _build_prompt(title: str, source_text: str, difficulty: str, count: int) -> str:
    difficulty_instruction = DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS["medium"])
    return f"""You are an expert Nigerian university exam question writer for SparkL, a student exam-prep platform.

Your task: Generate {count} original MCQ questions based on the academic content below.

STRICT RULES:
1. DO NOT copy questions word-for-word from the source material.
2. REPHRASE, reframe, and vary the wording every time — students may have seen the original.
3. {difficulty_instruction}
4. Every question must have exactly 4 options (A, B, C, D) with only ONE correct answer.
5. Distractors must be plausible, not obviously wrong.
6. Write clear, concise explanations for the correct answer.
7. Vary question formats: definition, application, "which of the following", calculation, scenario-based.
8. Do NOT include question numbers like "1." in the question_text field.
9. Return ONLY valid JSON — no markdown fences, no preamble, no extra text.

PAPER: {title}

SOURCE CONTENT:
{source_text[:6000]}

Return this exact JSON structure:
{{
  "questions": [
    {{
      "question_number": 1,
      "question_text": "...",
      "options": {{
        "a": "...",
        "b": "...",
        "c": "...",
        "d": "..."
      }},
      "correct_answer": "a",
      "explanation": "..."
    }}
  ]
}}"""


def _extract_json(raw: str) -> dict:
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", cleaned)
        if match:
            return json.loads(match.group())
        raise HTTPException(
            status_code=500,
            detail="AI returned an unexpected response. Please try again.",
        )


# ── Global search ──────────────────────────────────────────────────────────────
# NOTE: This MUST stay before /{question_id} so FastAPI doesn't treat
#       "search" as a UUID param.

@router.get("/search")
async def search_questions(
    q: str = Query(..., min_length=2),
    limit: int = Query(default=10, ge=1, le=30),
    user: dict = Depends(get_current_user),
):
    term = q.strip()
    if not term:
        return {"results": [], "courses": [], "query": term}

    questions_res = _safe(lambda: (
        supabase.table("past_questions")
        .select(
            "id, title, year, created_at, "
            "course:courses(id, name, "
            "  department:departments(name, "
            "    institution:institutions(name)"
            "  )"
            ")"
        )
        .ilike("title", f"%{term}%")
        .eq("status", "approved")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    ))

    courses_res = _safe(lambda: (
        supabase.table("courses")
        .select(
            "id, name, "
            "department:departments(name, institution:institutions(name))"
        )
        .ilike("name", f"%{term}%")
        .order("name")
        .limit(limit)
        .execute()
    ))

    depts_res = _safe(lambda: (
        supabase.table("departments")
        .select("id, name, institution:institutions(name)")
        .ilike("name", f"%{term}%")
        .limit(15)
        .execute()
    ))

    inst_res = _safe(lambda: (
        supabase.table("institutions")
        .select("id, name")
        .ilike("name", f"%{term}%")
        .limit(10)
        .execute()
    ))

    dept_ids: list[str] = [d["id"] for d in (depts_res.data or [])]

    inst_ids = [i["id"] for i in (inst_res.data or [])]
    if inst_ids:
        depts_from_inst = _safe(lambda: (
            supabase.table("departments")
            .select("id")
            .in_("institution_id", inst_ids)
            .execute()
        ))
        dept_ids += [d["id"] for d in (depts_from_inst.data or [])]

    dept_courses: list[dict] = []
    if dept_ids:
        dept_courses_res = _safe(lambda: (
            supabase.table("courses")
            .select(
                "id, name, "
                "department:departments(name, institution:institutions(name))"
            )
            .in_("department_id", list(set(dept_ids)))
            .order("name")
            .limit(limit)
            .execute()
        ))
        dept_courses = dept_courses_res.data or []

    seen_course_ids: set[str] = set()
    merged_courses: list[dict] = []

    for row in (courses_res.data or []) + dept_courses:
        if not row or row.get("id") in seen_course_ids:
            continue
        seen_course_ids.add(row["id"])
        dept = row.get("department") or {}
        inst = dept.get("institution") or {}
        merged_courses.append({
            "id":          row["id"],
            "name":        row["name"],
            "department":  dept.get("name"),
            "institution": inst.get("name"),
        })

    shaped_questions: list[dict] = []
    for row in (questions_res.data or []):
        course = row.get("course") or {}
        dept   = course.get("department") or {}
        inst   = dept.get("institution") or {}
        shaped_questions.append({
            "id":    row["id"],
            "title": row["title"],
            "year":  row.get("year"),
            "course": {
                "id":          course.get("id"),
                "name":        course.get("name"),
                "department":  dept.get("name"),
                "institution": inst.get("name"),
            },
        })

    return {
        "results": shaped_questions[:limit],
        "courses": merged_courses[:limit],
        "query":   term,
    }


# ── Past-questions routes ──────────────────────────────────────────────────────

@router.get("/{question_id}")
async def get_question(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    row = _get_paper(question_id)
    if not _can_access(row, user):
        raise HTTPException(status_code=404, detail="Question not found.")

    response = (
        supabase.table("past_questions")
        .select(
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
    user: dict = Depends(get_current_user),
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


# ── Quiz endpoint ──────────────────────────────────────────────────────────────
# Must stay AFTER /{question_id} and /{question_id}/processed but the path
# /api/quiz/{question_id} lives under a separate prefix in quiz.py normally.
# If you want it here instead, register it as shown below.
# Frontend calls: GET /api/quiz/{questionId}?difficulty=medium&count=10&fresh=true
# So keep this in a separate quiz router (quiz.py) OR mount it here with a
# different prefix. Recommended: keep quiz.py separate and register both routers.


# ── Section routes ─────────────────────────────────────────────────────────────

@router.get("/section/{section_id}")
async def get_section_detail(
    section_id: str,
    user: dict = Depends(get_current_user),
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
    user: dict = Depends(get_current_user),
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


# ── Course-level aggregation ───────────────────────────────────────────────────

@router.get("/course/{course_id}/all")
async def get_all_course_questions(
    course_id: str,
    user: dict = Depends(get_current_user),
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
