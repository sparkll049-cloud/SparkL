# routers/dashboard.py
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.supabase_client import supabase
from app.cache import cached, invalidate

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

SUMMARY_TTL_SECONDS = 30


# ── helpers ───────────────────────────────────────────────────────────────────

def _update_streak(user_id: str) -> dict:
    """
    Read streak_current / streak_last_active from profiles,
    compare with today, update if needed, write back, return
    the updated streak dict.
    """
    today = date.today()

    profile_res = (
        supabase.table("profiles")
        .select("streak_current, streak_longest, streak_last_active")
        .eq("id", user_id)
        .single()
        .execute()
    )
    p = profile_res.data or {}
    current   = p.get("streak_current") or 0
    longest   = p.get("streak_longest") or 0
    last_raw  = p.get("streak_last_active")          # "YYYY-MM-DD" or None
    last_date = date.fromisoformat(last_raw) if last_raw else None

    if last_date == today:
        # Already logged today — nothing to change
        return {"streak_current": current, "streak_longest": longest}

    if last_date == today - timedelta(days=1):
        # Consecutive day — extend streak
        current += 1
    else:
        # Missed a day (or first ever) — reset
        current = 1

    longest = max(longest, current)

    # Write back
    supabase.table("profiles").update({
        "streak_current":     current,
        "streak_longest":     longest,
        "streak_last_active": today.isoformat(),
    }).eq("id", user_id).execute()

    # Log the day in streak_log (ignore duplicates via upsert on user_id+log_date)
    supabase.table("streak_log").upsert(
        {"user_id": user_id, "log_date": today.isoformat()},
        on_conflict="user_id,log_date",
    ).execute()

    # Invalidate cached summary so next load reflects new streak
    invalidate(f"dashboard_summary:{user_id}")

    return {"streak_current": current, "streak_longest": longest}


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/streak/update")
async def update_streak(user_id: str = Depends(get_current_user)):
    """
    Call this on every dashboard load (fire-and-forget from the frontend).
    Updates streak_current, streak_longest, streak_last_active on profiles
    and appends a row to streak_log.
    """
    result = _update_streak(user_id)
    return result


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
                "semester:semesters(name), "
                "streak_current, streak_longest, xp_total"
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

    with ThreadPoolExecutor(max_workers=4) as pool:
        profile_future  = pool.submit(get_profile)
        courses_future  = pool.submit(get_user_courses)
        recent_future   = pool.submit(get_recent_questions)
        uploads_future  = pool.submit(get_my_uploads)

        profile_res      = profile_future.result()
        user_courses_res = courses_future.result()
        rq               = recent_future.result()
        uploads_res      = uploads_future.result()

    profile  = profile_res.data or {}
    courses  = [
        row["course"]
        for row in (user_courses_res.data or [])
        if row.get("course")
    ]
    course_ids       = [c["id"] for c in courses]
    recent_questions = rq.data or []
    my_uploads       = uploads_res.count or 0

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
        "profile": {
            **profile,
            "courses": courses,
            # Normalise field names the frontend expects
            "streak": profile.get("streak_current") or 0,
            "xp":     profile.get("xp_total") or 0,
        },
        "recent_questions": recent_questions,
        "stats": {
            "questions_in_courses": questions_in_courses,
            "my_uploads":           my_uploads,
        },
    }