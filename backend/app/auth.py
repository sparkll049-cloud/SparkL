from fastapi import Header, HTTPException

from app.supabase_client import supabase


async def get_current_user(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid Authorization header"
        )

    token = authorization.split(" ")[1]

    try:
        user_res = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not user_res or not user_res.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user_res.user.id