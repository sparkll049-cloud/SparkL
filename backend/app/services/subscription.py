"""
app/services/subscription.py

Single source of truth for subscription limits.
Imported by:
  - app/routers/courses.py      (get_user_limits)
  - app/routers/payments.py     (get_plan_limits — used in /subscription/status)
  - app/routers/study.py        (Cram feature gating)

None = unlimited.
Downloads are NOT launched yet, so every plan has can_download=False.
"""

from datetime import datetime, timedelta, timezone

from app.supabase_client import supabase

TRIAL_DAYS = 7

FREE_PLAN_LIMITS = {
    "max_courses":         3,
    "read_mode_percent":   10,
    "practice_mode_max":   5,
    "can_download":        False,
    "downloads_per_day":   0,
    # Cram / AI study
    "cram_access":         False,
    "cram_max_sessions":   0,
    "cram_modes":          [],
    "cram_daily_messages": 0,
    "cram_daily_uploads":  0,
    "cram_youtube":        False,
}

BASIC_PLAN_LIMITS = {
    "max_courses":         None,
    "read_mode_percent":   100,
    "practice_mode_max":   None,
    "can_download":        False,
    "downloads_per_day":   0,
    # Cram: limited AI chats + 3 note uploads/day, no YouTube/links
    "cram_access":         True,
    "cram_max_sessions":   3,
    "cram_modes":          ["chat", "summary", "explain"],
    "cram_daily_messages": 20,      # <-- adjust: AI messages per day
    "cram_daily_uploads":  3,       # <-- adjust: note uploads per day
    "cram_youtube":        False,
}

PRO_PLAN_LIMITS = {
    "max_courses":         None,
    "read_mode_percent":   100,
    "practice_mode_max":   None,
    "can_download":        False,
    "downloads_per_day":   0,
    # Cram: unlimited uploads + chats, still no YouTube/links
    "cram_access":         True,
    "cram_max_sessions":   None,
    "cram_modes":          ["chat", "summary", "explain"],  # no quiz
    "cram_daily_messages": None,
    "cram_daily_uploads":  None,
    "cram_youtube":        False,
}

PREMIUM_PLAN_LIMITS = {
    "max_courses":         None,
    "read_mode_percent":   100,
    "practice_mode_max":   None,
    "can_download":        False,
    "downloads_per_day":   0,
    # Cram: everything, including YouTube URL / link study
    "cram_access":         True,
    "cram_max_sessions":   None,
    "cram_modes":          ["chat", "quiz", "summary", "explain"],
    "cram_daily_messages": None,
    "cram_daily_uploads":  None,
    "cram_youtube":        True,
}

PAID_PLAN_LIMITS = {
    "basic":   BASIC_PLAN_LIMITS,
    "pro":     PRO_PLAN_LIMITS,
    "premium": PREMIUM_PLAN_LIMITS,
}

# Trial gets premium limits
TRIAL_PLAN_LIMITS = PREMIUM_PLAN_LIMITS


def get_plan_limits(
    plan: str,
    expires_at: str | None,
    created_at: str | None,
) -> dict:
    """
    Evaluate a user's access tier from raw profile fields.

    Priority:
    1. Active paid subscription (basic/pro/premium) → tier limits, is_paid=True
    2. Within 7-day trial window                    → premium limits, is_paid=True, is_trial=True
    3. Everything else                              → free limits, is_paid=False
    """

    # ── 1. Active paid subscription ───────────────────────────────────────────
    tier_limits = PAID_PLAN_LIMITS.get(plan or "")
    if tier_limits and expires_at:
        try:
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry > datetime.now(timezone.utc):
                return {
                    "is_paid":  True,
                    "is_trial": False,
                    "plan":     plan,
                    **tier_limits,
                }
        except Exception:
            pass

    # ── 2. Trial window ───────────────────────────────────────────────────────
    if created_at:
        try:
            created    = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            trial_ends = created + timedelta(days=TRIAL_DAYS)
            now        = datetime.now(timezone.utc)
            if now < trial_ends:
                days_left = (trial_ends - now).days + 1
                return {
                    "is_paid":         True,
                    "is_trial":        True,
                    "plan":            "trial",
                    "trial_ends_at":   trial_ends.isoformat(),
                    "trial_days_left": days_left,
                    **TRIAL_PLAN_LIMITS,
                }
        except Exception:
            pass

    # ── 3. Free plan ──────────────────────────────────────────────────────────
    return {
        "is_paid":  False,
        "is_trial": False,
        "plan":     "free",
        **FREE_PLAN_LIMITS,
    }


def get_user_limits(user_id: str) -> dict:
    """
    Fetch the user's profile and return their current access limits.
    Used by courses.py and any other synchronous route that needs limits.
    """
    try:
        res = (
            supabase.table("profiles")
            .select("subscription_plan, subscription_expic, created_at")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        return {"is_paid": False, "is_trial": False, "plan": "free", **FREE_PLAN_LIMITS}

    data = res.data or {}
    return get_plan_limits(
        plan=data.get("subscription_plan") or "free",
        expires_at=data.get("subscription_expic"),
        created_at=data.get("created_at"),
    )
