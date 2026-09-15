# app/routers/community.py
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.auth import get_current_user
from app.supabase_client import supabase

router = APIRouter(prefix="/api/community", tags=["community"])


# ── Models ────────────────────────────────────────────────────────────────────

class AskQuestion(BaseModel):
    title: str
    description: str
    institution_id: Optional[str] = None
    course_id: Optional[str] = None
    course_code: Optional[str] = None

class PostAnswer(BaseModel):
    content: str


# ── Questions ─────────────────────────────────────────────────────────────────

@router.get("/questions")
async def list_questions(
    status: Optional[str] = Query(None),   # "answered" | "unanswered"
    institution_id: Optional[str] = Query(None),
    course_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query("recent"),  # "recent" | "popular"
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

    # Fetch saved question IDs for current user
    saved_res = (
        supabase.table("community_saved_questions")
        .select("question_id")
        .eq("user_id", user_id)
        .execute()
    )
    saved_ids = {s["question_id"] for s in (saved_res.data or [])}

    for q in questions:
        q["is_saved"] = q["id"] in saved_ids
        # Flatten answer count
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
            "id, title, description, course_code, views, is_answered, created_at, "
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

    # Increment view count
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
        .order("is_accepted", desc=True)
        .order("helpful_count", desc=True)
        .order("created_at", desc=False)
        .execute()
    )

    answers = res.data or []

    # Check which answers this user has voted helpful
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

    # Check question exists
    q = (
        supabase.table("community_questions")
        .select("id")
        .eq("id", question_id)
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

    # Mark question as answered
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
    # Check if vote exists
    existing = (
        supabase.table("community_answer_votes")
        .select("id")
        .eq("answer_id", answer_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Remove vote
        supabase.table("community_answer_votes").delete().eq(
            "answer_id", answer_id
        ).eq("user_id", user_id).execute()

        # Decrement count
        answer = supabase.table("community_answers").select("helpful_count").eq("id", answer_id).maybe_single().execute()
        current = answer.data["helpful_count"] if answer.data else 0
        supabase.table("community_answers").update(
            {"helpful_count": max(0, current - 1)}
        ).eq("id", answer_id).execute()

        return {"voted": False}
    else:
        # Add vote
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