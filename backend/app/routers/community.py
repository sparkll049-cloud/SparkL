# app/routers/community.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.auth import get_current_user
from app.supabase_client import supabase

router = APIRouter(prefix="/api/community", tags=["community"])

REPORT_HIDE_THRESHOLD = 3


# ── Models ────────────────────────────────────────────────────────────────────

class AskQuestion(BaseModel):
    title: str
    description: str
    institution_id: Optional[str] = None
    course_id: Optional[str] = None
    course_code: Optional[str] = None

class PostAnswer(BaseModel):
    content: str

class ReportPayload(BaseModel):
    reason: Optional[str] = "inappropriate"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _auto_hide_if_threshold(*, question_id: str = None, answer_id: str = None):
    """Hide content automatically once report count hits the threshold."""
    if question_id:
        count_res = (
            supabase.table("community_reports")
            .select("id", count="exact")
            .eq("question_id", question_id)
            .execute()
        )
        if (count_res.count or 0) >= REPORT_HIDE_THRESHOLD:
            supabase.table("community_questions").update(
                {"is_hidden": True}
            ).eq("id", question_id).execute()

    if answer_id:
        count_res = (
            supabase.table("community_reports")
            .select("id", count="exact")
            .eq("answer_id", answer_id)
            .execute()
        )
        if (count_res.count or 0) >= REPORT_HIDE_THRESHOLD:
            supabase.table("community_answers").update(
                {"is_hidden": True}
            ).eq("id", answer_id).execute()


# ── Questions ─────────────────────────────────────────────────────────────────

@router.get("/questions")
async def list_questions(
    status: Optional[str] = Query(None),
    institution_id: Optional[str] = Query(None),
    course_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query("recent"),
    user_id: str = Depends(get_current_user),
):
    query = (
        supabase.table("community_questions")
        .select(
            "id, title, description, course_code, views, is_answered, created_at, "
            "institution:institutions(id, name), "
            "course:courses(id, name), "
            "asker:profiles!asked_by(id, full_name), "
            "answers:community_answers(count)"
        )
        .eq("is_hidden", False)
        .order("created_at", desc=(sort == "recent"))
    )

    if status == "answered":
        query = query.eq("is_answered", True)
    elif status == "unanswered":
        query = query.eq("is_answered", False)

    if institution_id:
        query = query.eq("institution_id", institution_id)

    if course_id:
        query = query.eq("course_id", course_id)

    if search:
        query = query.ilike("title", f"%{search}%")

    res = query.execute()
    questions = res.data or []

    if sort == "popular":
        questions = sorted(questions, key=lambda q: q.get("views", 0), reverse=True)

    saved_res = (
        supabase.table("community_saved_questions")
        .select("question_id")
        .eq("user_id", user_id)
        .execute()
    )
    saved_ids = {s["question_id"] for s in (saved_res.data or [])}

    for q in questions:
        q["is_saved"] = q["id"] in saved_ids
        q["answer_count"] = q.get("answers", [{}])[0].get("count", 0) if q.get("answers") else 0
        q.pop("answers", None)

    return questions


@router.post("/questions")
async def ask_question(
    payload: AskQuestion,
    user_id: str = Depends(get_current_user),
):
    if not payload.title.strip() or not payload.description.strip():
        raise HTTPException(status_code=400, detail="Title and description are required.")

    res = (
        supabase.table("community_questions")
        .insert({
            "title": payload.title.strip(),
            "description": payload.description.strip(),
            "institution_id": payload.institution_id,
            "course_id": payload.course_id,
            "course_code": payload.course_code.upper() if payload.course_code else None,
            "asked_by": user_id,
        })
        .execute()
    )

    return res.data[0]


@router.get("/questions/{question_id}")
async def get_question(
    question_id: str,
    user_id: str = Depends(get_current_user),
):
    res = (
        supabase.table("community_questions")
        .select(
            "id, title, description, course_code, views, is_answered, is_hidden, created_at, "
            "institution:institutions(id, name), "
            "course:courses(id, name), "
            "asker:profiles!asked_by(id, full_name)"
        )
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    if res.data.get("is_hidden"):
        raise HTTPException(status_code=404, detail="Question not found.")

    supabase.table("community_questions").update(
        {"views": (res.data["views"] or 0) + 1}
    ).eq("id", question_id).execute()

    return res.data


# ── Answers ───────────────────────────────────────────────────────────────────

@router.get("/questions/{question_id}/answers")
async def list_answers(
    question_id: str,
    user_id: str = Depends(get_current_user),
):
    res = (
        supabase.table("community_answers")
        .select(
            "id, content, helpful_count, is_accepted, created_at, "
            "answerer:profiles!answered_by(id, full_name)"
        )
        .eq("question_id", question_id)
        .eq("is_hidden", False)
        .order("is_accepted", desc=True)
        .order("helpful_count", desc=True)
        .order("created_at", desc=False)
        .execute()
    )

    answers = res.data or []

    vote_res = (
        supabase.table("community_answer_votes")
        .select("answer_id")
        .eq("user_id", user_id)
        .execute()
    )
    voted_ids = {v["answer_id"] for v in (vote_res.data or [])}

    for a in answers:
        a["voted_helpful"] = a["id"] in voted_ids

    return answers


@router.post("/questions/{question_id}/answers")
async def post_answer(
    question_id: str,
    payload: PostAnswer,
    user_id: str = Depends(get_current_user),
):
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Answer content is required.")

    q = (
        supabase.table("community_questions")
        .select("id")
        .eq("id", question_id)
        .eq("is_hidden", False)
        .maybe_single()
        .execute()
    )
    if not q.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    res = (
        supabase.table("community_answers")
        .insert({
            "question_id": question_id,
            "answered_by": user_id,
            "content": payload.content.strip(),
        })
        .execute()
    )

    supabase.table("community_questions").update(
        {"is_answered": True}
    ).eq("id", question_id).execute()

    return res.data[0]


# ── Helpful votes ─────────────────────────────────────────────────────────────

@router.post("/answers/{answer_id}/vote")
async def toggle_vote(
    answer_id: str,
    user_id: str = Depends(get_current_user),
):
    existing = (
        supabase.table("community_answer_votes")
        .select("id")
        .eq("answer_id", answer_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        supabase.table("community_answer_votes").delete().eq(
            "answer_id", answer_id
        ).eq("user_id", user_id).execute()

        answer = supabase.table("community_answers").select("helpful_count").eq("id", answer_id).maybe_single().execute()
        current = answer.data["helpful_count"] if answer.data else 0
        supabase.table("community_answers").update(
            {"helpful_count": max(0, current - 1)}
        ).eq("id", answer_id).execute()

        return {"voted": False}
    else:
        supabase.table("community_answer_votes").insert({
            "answer_id": answer_id,
            "user_id": user_id,
        }).execute()

        answer = supabase.table("community_answers").select("helpful_count").eq("id", answer_id).maybe_single().execute()
        current = answer.data["helpful_count"] if answer.data else 0
        supabase.table("community_answers").update(
            {"helpful_count": current + 1}
        ).eq("id", answer_id).execute()

        return {"voted": True}


# ── Public avatar ─────────────────────────────────────────────────────────────

@router.get("/users/{target_user_id}/avatar")
async def get_user_avatar(
    target_user_id: str,
    user_id: str = Depends(get_current_user),
):
    from app.storage import get_signed_url

    res = (
        supabase.table("profiles")
        .select("avatar_key, full_name")
        .eq("id", target_user_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found.")

    key = res.data.get("avatar_key")
    signed_url = get_signed_url(key) if key else None

    return {
        "avatar_url": signed_url,
        "full_name": res.data.get("full_name"),
    }


# ── Report ────────────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/report")
async def report_question(
    question_id: str,
    payload: ReportPayload,
    user_id: str = Depends(get_current_user),
):
    # Prevent duplicate reports from the same user
    existing = (
        supabase.table("community_reports")
        .select("id")
        .eq("question_id", question_id)
        .eq("reporter_id", user_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        return {"reported": True, "already_reported": True}

    supabase.table("community_reports").insert({
        "reporter_id": user_id,
        "question_id": question_id,
        "reason": payload.reason,
    }).execute()

    _auto_hide_if_threshold(question_id=question_id)

    return {"reported": True, "already_reported": False}


@router.post("/answers/{answer_id}/report")
async def report_answer(
    answer_id: str,
    payload: ReportPayload,
    user_id: str = Depends(get_current_user),
):
    existing = (
        supabase.table("community_reports")
        .select("id")
        .eq("answer_id", answer_id)
        .eq("reporter_id", user_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        return {"reported": True, "already_reported": True}

    supabase.table("community_reports").insert({
        "reporter_id": user_id,
        "answer_id": answer_id,
        "reason": payload.reason,
    }).execute()

    _auto_hide_if_threshold(answer_id=answer_id)

    return {"reported": True, "already_reported": False}


# ── Accept answer ─────────────────────────────────────────────────────────────

@router.post("/answers/{answer_id}/accept")
async def accept_answer(
    answer_id: str,
    user_id: str = Depends(get_current_user),
):
    answer_res = (
        supabase.table("community_answers")
        .select("id, question_id")
        .eq("id", answer_id)
        .maybe_single()
        .execute()
    )
    if not answer_res.data:
        raise HTTPException(status_code=404, detail="Answer not found.")

    question_res = (
        supabase.table("community_questions")
        .select("id, asked_by")
        .eq("id", answer_res.data["question_id"])
        .maybe_single()
        .execute()
    )
    if not question_res.data or question_res.data["asked_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only the question author can accept answers.")

    supabase.table("community_answers").update(
        {"is_accepted": False}
    ).eq("question_id", answer_res.data["question_id"]).execute()

    supabase.table("community_answers").update(
        {"is_accepted": True}
    ).eq("id", answer_id).execute()

    return {"accepted": True}


# ── Save / unsave ─────────────────────────────────────────────────────────────

@router.post("/questions/{question_id}/save")
async def toggle_save(
    question_id: str,
    user_id: str = Depends(get_current_user),
):
    existing = (
        supabase.table("community_saved_questions")
        .select("id")
        .eq("question_id", question_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        supabase.table("community_saved_questions").delete().eq(
            "question_id", question_id
        ).eq("user_id", user_id).execute()
        return {"saved": False}
    else:
        supabase.table("community_saved_questions").insert({
            "question_id": question_id,
            "user_id": user_id,
        }).execute()
        return {"saved": True}