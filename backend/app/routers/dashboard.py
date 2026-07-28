from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.supabase_client import supabase

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_dashboard_summary(user_id: str = Depends(get_current_user)):
    profile_res = (
        supabase.table("profiles")
        .select(
            "full_name, phone, "
            "institution:institutions(name), "
            "department:departments(name), "
            "level:levels(name), "
            "study_mode:study_modes(name), "
            "semester:semesters(name)"
        )
        .eq("id", user_id)
        .single()
        .execute()
    )

    profile = profile_res.data or {}

    user_courses_res = (
        supabase.table("user_courses")
        .select("course:courses(id, name)")
        .eq("user_id", user_id)
        .execute()
    )

    courses = [
        row["course"] for row in (user_courses_res.data or []) if row.get("course")
    ]
    course_ids = [c["id"] for c in courses]

    recent_questions = []
    questions_in_courses = 0

    if course_ids:
        rq = (
            supabase.table("past_questions")
            .select("id, title, year, created_at, course:courses(name)")
            .in_("course_id", course_ids)
            .eq("status", "approved")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        recent_questions = rq.data or []

        count_res = (
            supabase.table("past_questions")
            .select("id", count="exact")
            .in_("course_id", course_ids)
            .eq("status", "approved")
            .execute()
        )
        questions_in_courses = count_res.count or 0

    uploads_res = (
        supabase.table("past_questions")
        .select("id", count="exact")
        .eq("uploaded_by", user_id)
        .execute()
    )
    my_uploads = uploads_res.count or 0

    return {
        "profile": {**profile, "courses": courses},
        "recent_questions": recent_questions,
        "stats": {
            "questions_in_courses": questions_in_courses,
            "my_uploads": my_uploads,
        },
    }