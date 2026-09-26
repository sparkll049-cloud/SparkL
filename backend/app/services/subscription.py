"""
app/services/subscription.py

Single source of truth for subscription limits.
Imported by:
  - app/routers/courses.py      (get_user_limits)
  - app/routers/payments.py     (get_plan_limits — used in /subscription/status)
  - app/routers/study.py        (Cram feature gating)
"""

from datetime import datetime, timedelta, timezone

from app.supabase_client import supabase

TRIAL_DAYS = 7

FREE_PLAN_LIMITS = {
    "max_courses":        3,
    "read_mode_percent":  10,
    "practice_mode_max":  5,
    "can_download":       False,
    # Cram
    "cram_access":        False,
    "cram_max_sessions":  0,
    "cram_modes":         [],
}

PRO_PLAN_LIMITS = {
    "max_courses":        None,
    "read_mode_percent":  100,
    "practice_mode_max":  None,
    "can_download":       True,
    # Cram
    "cram_access":        True,
    "cram_max_sessions":  3,
    "cram_modes":         ["chat", "summary", "explain"],  # no quiz
}

PREMIUM_PLAN_LIMITS = {
    "max_courses":        None,
    "read_mode_percent":  100,
    "practice_mode_max":  None,
    "can_download":       True,
    # Cram
    "cram_access":        True,
    "cram_max_sessions":  None,   # unlimited
    "cram_modes":         ["chat", "quiz", "summary", "explain"],
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
    1. Active paid subscription (pro/premium) → tier limits, is_paid=True
    2. Within 7-day trial window              → premium limits, is_paid=True, is_trial=True
    3. Everything else                        → free limits, is_paid=False
    """

    # ── 1. Active paid subscription ───────────────────────────────────────────
    if plan and plan not in ("free", "trial") and expires_at:
        try:
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expiry > datetime.now(timezone.utc):
                limits = PRO_PLAN_LIMITS if plan == "pro" else PREMIUM_PLAN_LIMITS
                return {
                    "is_paid":  True,
                    "is_trial": False,
                    "plan":     plan,
                    **limits,
                }
        except Exception:
            pass

    # ── 2. Trial window ───────────────────────────────────────────────────────
    if created_at:
        try:
            created    = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            trial_ends = created + timedelta(days=TRIAL_DAYS)
            now        = datetime.now(timezone.utc)
            if now < trial_ends:
                days_left = (trial_ends - now).days + 1
                return {
                    "is_paid":        True,
                    "is_trial":       True,
                    "plan":           "trial",
                    "trial_ends_at":  trial_ends.isoformat(),
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