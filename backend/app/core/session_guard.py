"""
session_guard.py
────────────────
Single-device session enforcement for SparkL's FastAPI backend.

Drop this file anywhere in your project and wire it up as shown at the bottom.

How it works
────────────
1. The Next.js frontend stores a random UUID in localStorage ("sp_device_id")
   and attaches it as the X-Device-Id header on every request to your API.

2. On login / token refresh, call `register_device(user_id, device_id)` to
   save that UUID in profiles.active_device_id.

3. `get_current_user_id` (your existing auth dependency) calls
   `assert_active_device(user_id, device_id)`.  If the IDs don't match, it
   raises HTTP 401 {"detail": "session_conflict"}.

4. The frontend's useSessionGuard hook listens for Supabase SIGNED_OUT, which
   Supabase fires when signOut() is called here.  The old browser tab is then
   kicked to /auth/login?reason=conflict.
"""

from __future__ import annotations

import os
from functools import lru_cache

from fastapi import Depends, Header, HTTPException, Request, status
from gotrue import SyncGoTrueClient
from supabase import Client, create_client


# ── Supabase client ────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url  = os.environ["SUPABASE_URL"]
    # Use the service-role key so we can write to profiles without RLS.
    key  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


# ── Device registration ────────────────────────────────────────────────────────

def register_device(user_id: str, device_id: str) -> None:
    """
    Call this whenever a user successfully logs in or refreshes their token.
    Overwrites any previously stored device — only the newest device wins.

    Example (in your login route):
        register_device(user.id, request.headers.get("x-device-id", ""))
    """
    if not device_id:
        return  # No device header → skip (graceful degradation)

    supabase = get_supabase()
    supabase.table("profiles").update(
        {"active_device_id": device_id}
    ).eq("id", user_id).execute()


# ── Device assertion ───────────────────────────────────────────────────────────

def assert_active_device(user_id: str, device_id: str | None) -> None:
    """
    Raises HTTP 401 {"detail": "session_conflict"} if device_id doesn't match
    the one stored in profiles.active_device_id.

    Skips the check when device_id is absent (old clients, tests, Postman).
    """
    if not device_id:
        return  # Graceful degradation — enforce only when header is present

    supabase = get_supabase()
    result = (
        supabase.table("profiles")
        .select("active_device_id")
        .eq("id", user_id)
        .single()
        .execute()
    )

    row = result.data
    if not row:
        return  # Profile doesn't exist yet — let the request through

    stored = row.get("active_device_id")

    # If a device has never been registered, register this one automatically.
    if stored is None:
        register_device(user_id, device_id)
        return

    if stored != device_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="session_conflict",
        )


# ── FastAPI dependency ─────────────────────────────────────────────────────────
#
# Replace (or wrap) your existing get_current_user_id with this version.
# It does everything the old one did, then enforces the device check.
#
# If you already have your own JWT-verification logic, just call
# assert_active_device(user_id, device_id) at the end of it.

async def get_current_user_id(
    request: Request,
    authorization: str | None = Header(default=None),
    x_device_id:   str | None = Header(default=None),
) -> str:
    """
    FastAPI dependency.  Returns the authenticated user's UUID.
    Raises 401 if the token is missing/invalid or if the device doesn't match.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )

    token    = authorization.removeprefix("Bearer ").strip()
    supabase = get_supabase()

    # Verify the JWT with Supabase
    try:
        response = supabase.auth.get_user(token)
        user     = response.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token.",
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc

    # Single-device enforcement
    assert_active_device(user.id, x_device_id)

    return user.id


# ── Login route helper ─────────────────────────────────────────────────────────
#
# Call register_device inside your existing login / OAuth callback route.
# Example:
#
#   @router.post("/auth/login")
#   async def login(body: LoginBody, request: Request):
#       # ... your existing Supabase sign-in ...
#       user_id   = session.user.id
#       device_id = request.headers.get("x-device-id", "")
#       register_device(user_id, device_id)
#       return {"access_token": session.access_token, ...}
#
# That is the only change needed in your auth routes.
