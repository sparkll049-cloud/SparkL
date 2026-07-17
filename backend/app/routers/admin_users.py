from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.admin_auth import get_current_admin
from app.supabase_client import supabase

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class SuspendUpdate(BaseModel):
    suspended: bool


class AdminUpdate(BaseModel):
    is_admin: bool


@router.get("")
async def list_users(admin_id: str = Depends(get_current_admin)):
    res = (
        supabase.table("profiles")
        .select(
            "id, full_name, phone, is_admin, suspended, created_at, "
            "institution:institutions(name), "
            "department:departments(name), "
            "level:levels(name), "
            "user_courses(course:courses(id, name))"
        )
        .order("created_at", desc=True)
        .execute()
    )

    users = res.data or []

    # Flatten the nested user_courses -> course structure into a plain "courses" array
    for user in users:
        raw = user.pop("user_courses", []) or []
        user["courses"] = [row["course"] for row in raw if row.get("course")]

    return users


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
        raise HTTPException(status_code=404, detail="User not found")

    try:
        if payload.suspended:
            supabase.auth.admin.update_user_by_id(
                user_id, {"ban_duration": "876000h"}
            )
        else:
            supabase.auth.admin.update_user_by_id(
                user_id, {"ban_duration": "none"}
            )
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
            status_code=400, detail="You cannot remove your own admin access."
        )

    res = (
        supabase.table("profiles")
        .update({"is_admin": payload.is_admin})
        .eq("id", user_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")

    return res.data[0]