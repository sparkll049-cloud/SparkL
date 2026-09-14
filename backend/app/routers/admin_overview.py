from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from app.admin_auth import get_current_admin
from app.supabase_client import supabase
from app.cache import cached

router = APIRouter(prefix="/api/admin/overview", tags=["admin-overview"])

OVERVIEW_TTL_SECONDS = 60


# ── Helpers ──────────────────────────────────────────────────────────────────

def _count(table: str, **filters) -> int:
    query = supabase.table(table).select("id", count="exact")
    for key, value in filters.items():
        query = query.eq(key, value)
    return query.execute().count or 0


def _count_since(table: str, since: datetime, **filters) -> int:
    """Count rows created after `since` (UTC datetime)."""
    query = (
        supabase.table(table)
        .select("id", count="exact")
        .gte("created_at", since.isoformat())
    )
    for key, value in filters.items():
        query = query.eq(key, value)
    return query.execute().count or 0


def _daily_counts(table: str, days: int = 7) -> list[int]:
    """
    Return a list of `days` integers: how many rows were created
    on each of the last `days` calendar days (oldest → newest).
    """
    now = datetime.now(timezone.utc)
    counts = []
    for offset in range(days - 1, -1, -1):
        day_start = (now - timedelta(days=offset)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)
        res = (
            supabase.table(table)
            .select("id", count="exact")
            .gte("created_at", day_start.isoformat())
            .lt("created_at", day_end.isoformat())
            .execute()
        )
        counts.append(res.count or 0)
    return counts


def _total_views() -> int:
    """Sum view_count across all past_questions."""
    res = supabase.table("past_questions").select("view_count").execute()
    rows = res.data or []
    return sum((r.get("view_count") or 0) for r in rows)


# ── Route ────────────────────────────────────────────────────────────────────

@router.get("")
async def get_overview(admin_id: str = Depends(get_current_admin)):
    return cached("admin_overview", OVERVIEW_TTL_SECONDS, _fetch_overview)


def _fetch_overview() -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    # ── Core counts ──
    total_users               = _count("profiles")
    suspended_users           = _count("profiles", suspended=True)
    total_institutions        = _count("institutions")
    total_departments         = _count("departments")
    total_courses             = _count("courses")
    total_questions           = _count("past_questions")
    pending_questions         = _count("past_questions", status="pending")
    approved_questions        = _count("past_questions", status="approved")
    rejected_questions        = _count("past_questions", status="rejected")

    # ── Growth metrics ──
    new_users_today           = _count_since("profiles", today_start)
    new_users_this_week       = _count_since("profiles", week_start)
    new_questions_this_week   = _count_since("past_questions", week_start)

    # ── Engagement ──
    total_views               = _total_views()

    # ── Approval rate (guard div-by-zero) ──
    approval_rate = (
        round((approved_questions / total_questions) * 100)
        if total_questions > 0 else 0
    )

    # ── 7-day sparkline trends ──
    upload_trend = _daily_counts("past_questions", days=7)
    user_trend   = _daily_counts("profiles", days=7)

    # ── Recent activity ──
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
            # Core
            "total_users":              total_users,
            "suspended_users":          suspended_users,
            "total_institutions":       total_institutions,
            "total_departments":        total_departments,
            "total_courses":            total_courses,
            "total_questions":          total_questions,
            "pending_questions":        pending_questions,
            "approved_questions":       approved_questions,
            "rejected_questions":       rejected_questions,
            # Growth
            "new_users_today":          new_users_today,
            "new_users_this_week":      new_users_this_week,
            "new_questions_this_week":  new_questions_this_week,
            # Engagement
            "total_views":              total_views,
            "approval_rate":            approval_rate,
        },
        # Sparklines (7 values, oldest → newest)
        "upload_trend": upload_trend,
        "user_trend":   user_trend,
        # Recent lists
        "recent_users":     recent_users_res.data or [],
        "recent_questions": recent_questions_res.data or [],
    }
