from fastapi import APIRouter, Depends

from app.admin_auth import get_current_admin
from app.supabase_client import supabase
from app.cache import cached

router = APIRouter(prefix="/api/admin/overview", tags=["admin-overview"])

OVERVIEW_TTL_SECONDS = 60


def count(table: str, **filters) -> int:
    query = supabase.table(table).select("id", count="exact")
    for key, value in filters.items():
        query = query.eq(key, value)
    res = query.execute()
    return res.count or 0


@router.get("")
async def get_overview(admin_id: str = Depends(get_current_admin)):
    return cached("admin_overview", OVERVIEW_TTL_SECONDS, _fetch_overview)


def _fetch_overview() -> dict:
    total_users = count("profiles")
    total_institutions = count("institutions")
    total_departments = count("departments")
    total_courses = count("courses")
    total_questions = count("past_questions")
    pending_questions = count("past_questions", status="pending")
    approved_questions = count("past_questions", status="approved")
    rejected_questions = count("past_questions", status="rejected")
    suspended_users = count("profiles", suspended=True)

    recent_users_res = (
        supabase.table("profiles")
        .select("id, full_name, created_at, institution:institutions(name)")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    recent_questions_res = (
        supabase.table("past_questions")
        .select(
            "id, title, status, created_at, "
            "course:courses(name), "
            "uploader:profiles!past_questions_uploaded_by_profiles_fkey(full_name)"
        )
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    return {
        "stats": {
            "total_users": total_users,
            "suspended_users": suspended_users,
            "total_institutions": total_institutions,
            "total_departments": total_departments,
            "total_courses": total_courses,
            "total_questions": total_questions,
            "pending_questions": pending_questions,
            "approved_questions": approved_questions,
            "rejected_questions": rejected_questions,
        },
        "recent_users": recent_users_res.data or [],
        "recent_questions": recent_questions_res.data or [],
    }
