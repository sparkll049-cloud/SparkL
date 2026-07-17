from fastapi import Depends, HTTPException

from app.auth import get_current_user
from app.supabase_client import supabase


async def get_current_admin(user_id: str = Depends(get_current_user)) -> str:
    profile_res = (
        supabase.table("profiles")
        .select("is_admin")
        .eq("id", user_id)
        .single()
        .execute()
    )

    profile = profile_res.data

    if not profile or not profile.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    return user_id