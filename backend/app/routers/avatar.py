"""
avatar.py
---------
Profile picture upload. Stores image in Backblaze B2,
saves the B2 key to profiles.avatar_key, and returns
a signed URL for immediate display.
"""

from __future__ import annotations

import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status

from app.supabase_client import supabase
from app.storage import upload_file, delete_file, get_signed_url

router = APIRouter(prefix="/api/avatar", tags=["Avatar"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB

AVATAR_SIGNATURES = {
    b"\xff\xd8\xff":       ("image/jpeg", "jpg"),
    b"\x89PNG\r\n\x1a\n": ("image/png",  "png"),
}


def detect_image_type(file_bytes: bytes) -> tuple[str, str]:
    for sig, (mime, ext) in AVATAR_SIGNATURES.items():
        if file_bytes.startswith(sig):
            return mime, ext
    raise HTTPException(status_code=415, detail="Only JPG and PNG images are allowed.")


async def get_current_user_id(
    authorization: Optional[str] = Header(None),
) -> UUID:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user = getattr(user_response, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return UUID(user.id)


@router.post("", status_code=200, summary="Upload or replace profile avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id),
):
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty.")
    if len(file_bytes) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Avatar must be under 5 MB.")

    mime_type, ext = detect_image_type(file_bytes)

    # Delete old avatar from B2 if one exists
    existing = (
        supabase.table("profiles")
        .select("avatar_key")
        .eq("id", str(user_id))
        .single()
        .execute()
    )
    old_key = (existing.data or {}).get("avatar_key")
    if old_key:
        try:
            delete_file(old_key)
        except Exception:
            pass  # don't block if old file is already gone

    # Upload new file to B2 under avatars/{user_id}/{uuid}.ext
    storage_key = upload_file(
        file_bytes=file_bytes,
        user_id=f"avatars/{user_id}",
        mime_type=mime_type,
        ext=ext,
    )

    # Save B2 key to profiles table
    supabase.table("profiles").update(
        {"avatar_key": storage_key}
    ).eq("id", str(user_id)).execute()

    # Return a short-lived signed URL for immediate display
    signed_url = get_signed_url(storage_key)
    return {"avatar_url": signed_url, "avatar_key": storage_key}


@router.get("/me", status_code=200, summary="Get signed avatar URL for current user")
async def get_my_avatar(user_id: UUID = Depends(get_current_user_id)):
    result = (
        supabase.table("profiles")
        .select("avatar_key")
        .eq("id", str(user_id))
        .single()
        .execute()
    )
    key = (result.data or {}).get("avatar_key")
    if not key:
        return {"avatar_url": None}
    signed_url = get_signed_url(key)
    return {"avatar_url": signed_url}