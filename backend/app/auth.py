# auth.py
from fastapi import Header, HTTPException
from app.supabase_client import supabase
from app.storage import upload_file
import httpx


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

    user = user_res.user
    user_id = user.id

    # Auto-sync Google profile picture if not already saved
    await _sync_google_avatar_if_needed(user_id, user)

    return user_id


async def _sync_google_avatar_if_needed(user_id: str, user) -> None:
    try:
        # Check if user already has an avatar_key
        result = (
            supabase.table("profiles")
            .select("avatar_key")
            .eq("id", user_id)
            .single()
            .execute()
        )
        existing_key = (result.data or {}).get("avatar_key")

        # Already has avatar, skip
        if existing_key:
            return

        # Get Google picture URL from user metadata
        user_meta = getattr(user, "user_metadata", {}) or {}
        picture_url = user_meta.get("picture") or user_meta.get("avatar_url")

        if not picture_url:
            return

        # Download image from Google
        async with httpx.AsyncClient() as client:
            response = await client.get(picture_url, timeout=10)
            if response.status_code != 200:
                return
            image_bytes = response.content

        # Detect image type
        if image_bytes.startswith(b"\xff\xd8\xff"):
            mime_type, ext = "image/jpeg", "jpg"
        elif image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            mime_type, ext = "image/png", "png"
        else:
            return

        # Upload to Backblaze
        storage_key = upload_file(
            file_bytes=image_bytes,
            user_id=f"avatars/{user_id}",
            mime_type=mime_type,
            ext=ext,
        )

        # Save key to profiles table
        supabase.table("profiles").update(
            {"avatar_key": storage_key}
        ).eq("id", user_id).execute()

    except Exception:
        pass  # Never block the request if avatar sync fails