"""
services/subscription.py
------------------------
Central place for plan limit definitions.
Free plan: read 10% of questions (min 1), practice max 5.
"""

from datetime import datetime, timezone


PLAN_LIMITS = {
    "free": {
        "read_mode_percent": 10,      # show 10% of questions in read mode
        "practice_mode_max": 5,       # max 5 questions in practice mode
        "downloads_per_day": 0,
        "all_institutions": False,
    },
    "trial": {
        "read_mode_percent": 10,
        "practice_mode_max": 5,
        "downloads_per_day": 0,
        "all_institutions": False,
    },
    "basic": {
        "read_mode_percent": 100,
        "practice_mode_max": None,    # unlimited
        "downloads_per_day": 10,
        "all_institutions": False,
    },
    "pro": {
        "read_mode_percent": 100,
        "practice_mode_max": None,
        "downloads_per_day": 50,
        "all_institutions": True,
    },
    "premium": {
        "read_mode_percent": 100,
        "practice_mode_max": None,
        "downloads_per_day": None,    # unlimited
        "all_institutions": True,
    },
}

TRIAL_DAYS = 7


def get_plan_limits(
    plan: str,
    expires_at: str | None,
    created_at: str | None,
) -> dict:
    now = datetime.now(timezone.utc)

    # Check if paid plan has expired → downgrade to free
    is_paid = False
    if plan and plan not in ("free", "trial"):
        if expires_at:
            try:
                expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                is_paid = expiry > now
            except Exception:
                is_paid = False
        else:
            is_paid = True  # no expiry set → treat as active

    # Trial window (first TRIAL_DAYS days on free plan)
    is_trial = False
    if not is_paid and plan in ("free", "trial", None) and created_at:
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            is_trial = (now - created).days < TRIAL_DAYS
        except Exception:
            pass

    effective_plan = plan if is_paid else ("trial" if is_trial else "free")
    limits = PLAN_LIMITS.get(effective_plan, PLAN_LIMITS["free"])

    return {
        "is_paid": is_paid,
        "is_trial": is_trial,
        "effective_plan": effective_plan,
        "read_mode_percent": limits["read_mode_percent"],
        "practice_mode_max": limits["practice_mode_max"],
        "downloads_per_day": limits["downloads_per_day"],
        "all_institutions": limits["all_institutions"],
    }
