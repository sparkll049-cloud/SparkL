from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.supabase_client import supabase
from app.cache import cached

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

SUMMARY_TTL_SECONDS = 30


@router.get("/summary")
async def get_dashboard_summary(user_id: str = Depends(get_current_user)):
    return cached(
        f"dashboard_summary:{user_id}",
        SUMMARY_TTL_SECONDS,
        lambda: _fetch_summary(user_id),
    )


def _fetch_summary(user_id: str) -> dict:
    def get_profile():
        return (
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

    def get_user_courses():
        return (
            supabase.table("user_courses")
            .select("course:courses(id, name)")
            .eq("user_id", user_id)
            .execute()
        )

    def get_recent_questions():
        # Recent activity is platform-wide — shows what's happening across
        # every course, not just the ones this student has selected. That's
        # deliberate: it's meant to surface new uploads students might not
        # know to look for yet.
        return (
            supabase.table("past_questions")
            .select("id, title, year, created_at, course:courses(name)")
            .eq("status", "approved")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )

    def get_my_uploads():
        return (
            supabase.table("past_questions")
            .select("id", count="exact")
            .eq("uploaded_by", user_id)
            .execute()
        )

    # Run the 4 independent queries concurrently
    with ThreadPoolExecutor(max_workers=4) as pool:
        profile_future = pool.submit(get_profile)
        courses_future = pool.submit(get_user_courses)
        recent_future = pool.submit(get_recent_questions)
        uploads_future = pool.submit(get_my_uploads)

        profile_res = profile_future.result()
        user_courses_res = courses_future.result()
        rq = recent_future.result()
        uploads_res = uploads_future.result()

    profile = profile_res.data or {}

    courses = [
        row["course"] for row in (user_courses_res.data or []) if row.get("course")
    ]
    course_ids = [c["id"] for c in courses]

    recent_questions = rq.data or []
    my_uploads = uploads_res.count or 0

    # "Past questions" stat stays scoped to the student's own selected
    # courses — that's a personal relevance count, distinct from the
    # platform-wide activity feed above. Depends on course_ids, so it
    # runs after the parallel batch.
    questions_in_courses = 0
    if course_ids:
        count_res = (
            supabase.table("past_questions")
            .select("id", count="exact")
            .in_("course_id", course_ids)
            .eq("status", "approved")
            .execute()
        )
        questions_in_courses = count_res.count or 0

    return {
        "profile": {**profile, "courses": courses},
        "recent_questions": recent_questions,
        "stats": {
            "questions_in_courses": questions_in_courses,
            "my_uploads": my_uploads,
        },
    }
