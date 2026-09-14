from fastapi import Depends, HTTPException
from fastapi import APIRouter
from pydantic import BaseModel

from app.admin_auth import get_current_admin
from app.supabase_client import supabase

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


# ── Pydantic models ─────────────────────────────────────────────────────────

class SuspendUpdate(BaseModel):
    suspended: bool


class AdminUpdate(BaseModel):
    is_admin: bool
    admin_role: str | None = None  # "moderator" | "content_manager" | "super_admin"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _flatten_user(user: dict) -> dict:
    """Flatten nested join structures into clean fields."""
    # Courses
    raw_courses = user.pop("user_courses", []) or []
    user["courses"] = [row["course"] for row in raw_courses if row.get("course")]

    # Upload count — use explicit FK key
    raw_uploads = user.pop(
        "past_questions!past_questions_uploaded_by_profiles_fkey", []
    ) or []
    user["total_uploads"] = len(raw_uploads)

    # Total views across uploads
    user["total_views"] = sum(
        (u.get("view_count") or 0) for u in raw_uploads
    )

    # Study mode
    sm = user.pop("study_mode", None)
    user["study_mode"] = sm

    return user


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_users(admin_id: str = Depends(get_current_admin)):
    res = (
        supabase.table("profiles")
        .select(
            "id, full_name, phone, email, is_admin, admin_role, suspended, "
            "created_at, last_active_at, subscription_plan, subscription_expires_at, "
            "institution:institutions(name), "
            "department:departments(name), "
            "level:levels(name), "
            "study_mode:study_modes(name), "
            "user_courses(course:courses(id, name)), "
            "past_questions!past_questions_uploaded_by_profiles_fkey(view_count)"
        )
        .order("created_at", desc=True)
        .execute()
    )

    users = res.data or []
    return [_flatten_user(u) for u in users]


@router.patch("/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    payload: SuspendUpdate,
    admin_id: str = Depends(get_current_admin),
):
    res = (
        supabase.table("profiles")
        .update({"suspended": payload.suspended})
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="User not found.")

    try:
        if payload.suspended:
            supabase.auth.admin.update_user_by_id(user_id, {"ban_duration": "876000h"})
        else:
            supabase.auth.admin.update_user_by_id(user_id, {"ban_duration": "none"})
    except Exception:
        pass  # Auth ban is best-effort; profile flag is the source of truth

    return res.data[0]


@router.patch("/{user_id}/admin")
async def set_admin_status(
    user_id: str,
    payload: AdminUpdate,
    admin_id: str = Depends(get_current_admin),
):
    if user_id == admin_id and not payload.is_admin:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own admin access.",
        )

    update_payload: dict = {"is_admin": payload.is_admin}

    if payload.is_admin:
        valid_roles = {"moderator", "content_manager", "super_admin"}
        role = payload.admin_role or "moderator"
        if role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid admin role '{role}'. Must be one of: {', '.join(valid_roles)}.",
            )
        update_payload["admin_role"] = role
    else:
        update_payload["admin_role"] = None

    res = (
        supabase.table("profiles")
        .update(update_payload)
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="User not found.")

    return res.data[0]


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    admin_id: str = Depends(get_current_admin),
):
    if user_id == admin_id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account.",
        )

    res = (
        supabase.table("profiles")
        .delete()
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="User not found.")

    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception:
        pass

    return {"deleted": True, "user_id": user_id}