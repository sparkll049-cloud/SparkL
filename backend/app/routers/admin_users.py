"""
admin/users.py
--------------
GET    /api/admin/users                  — list all users (with signed avatar URLs)
PATCH  /api/admin/users/{id}/suspend     — suspend / unsuspend
PATCH  /api/admin/users/{id}/admin       — grant / revoke admin role
DELETE /api/admin/users/{id}             — permanently delete account + B2 avatar
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, APIRouter
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.admin_auth import get_current_admin
from app.supabase_client import supabase
from app.storage import get_signed_url, delete_file

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])

AVATAR_TTL = 3600  # 1 hour


# ── Pydantic models ───────────────────────────────────────────────────────────

class SuspendUpdate(BaseModel):
    suspended: bool


class AdminUpdate(BaseModel):
    is_admin: bool
    admin_role: str | None = None  # "moderator" | "content_manager" | "super_admin"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sign_avatar(key: str | None) -> str | None:
    if not key:
        return None
    try:
        return get_signed_url(key, AVATAR_TTL)
    except Exception:
        return None


def _flatten_user(user: dict) -> dict:
    """Flatten nested join structures and resolve avatar_key → avatar_url."""
    # Avatar: resolve B2 key → signed URL
    avatar_key = user.pop("avatar_key", None)
    user["avatar_url"] = _sign_avatar(avatar_key)

    # Courses
    raw_courses = user.pop("user_courses", []) or []
    user["courses"] = [row["course"] for row in raw_courses if row.get("course")]

    # Upload count + view total
    raw_uploads = user.pop(
        "past_questions!past_questions_uploaded_by_profiles_fkey", []
    ) or []
    user["total_uploads"] = len(raw_uploads)
    user["total_views"] = sum((u.get("view_count") or 0) for u in raw_uploads)

    # Study mode (already a nested object from the join — keep as-is)
    # Nothing to pop; it's already shaped correctly by Supabase

    return user


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
async def list_users(admin_id: str = Depends(get_current_admin)):
    res = (
        supabase.table("profiles")
        .select(
            "id, full_name, phone, email, avatar_key, "   # ← added avatar_key
            "is_admin, admin_role, suspended, "
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

    # Sign all avatars in threadpool (avoids blocking the event loop)
    def flatten_all(rows: list[dict]) -> list[dict]:
        return [_flatten_user(u) for u in rows]

    return await run_in_threadpool(flatten_all, users)


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

    # Best-effort auth ban — don't fail the request if this errors
    try:
        ban = "876000h" if payload.suspended else "none"
        supabase.auth.admin.update_user_by_id(user_id, {"ban_duration": ban})
    except Exception:
        pass

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

    valid_roles = {"moderator", "content_manager", "super_admin"}
    update_payload: dict = {"is_admin": payload.is_admin}

    if payload.is_admin:
        role = payload.admin_role or "moderator"
        if role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role '{role}'. Must be one of: {', '.join(valid_roles)}.",
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

    # 1. Fetch avatar_key before deleting so we can clean up B2
    profile = (
        supabase.table("profiles")
        .select("id, avatar_key")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=404, detail="User not found.")

    avatar_key = profile.data.get("avatar_key")

    # 2. Delete avatar from B2 (best-effort)
    if avatar_key:
        try:
            await run_in_threadpool(delete_file, avatar_key)
        except Exception:
            pass

    # 3. Delete the Supabase auth user FIRST.
    #    This cascades to profiles via ON DELETE CASCADE (if configured),
    #    and is the call that was silently failing before.
    #    We raise explicitly here so the frontend gets a real error, not status 0.
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete auth user: {exc}",
        )

    # 4. Explicitly delete the profile row in case CASCADE isn't set
    supabase.table("profiles").delete().eq("id", user_id).execute()

    return {"deleted": True, "user_id": user_id}
