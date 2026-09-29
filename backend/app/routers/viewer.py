"""
viewer.py
---------
Serves protected past-question content to students and admins.

Students never receive:
  - the original B2 key
  - a permanent URL
  - a raw PDF or image byte stream of the original

What they DO receive:
  - server-rendered page images (for the page viewer)
  - structured question data (for practice mode — already handled in questions.py)
"""
from __future__ import annotations

import io
import os
import time
from functools import lru_cache
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.supabase_client import supabase
from app.storage import download_bytes, get_signed_url, B2_BUCKET

router = APIRouter(prefix="/api/questions", tags=["Viewer"])

SIGNED_URL_TTL = 300
FREE_PAGE_LIMIT = 2

# ── In-memory page cache ──────────────────────────────────────────────────────
# Stores rendered JPEG bytes per (question_id, page_number)
# TTL: 30 minutes — clears itself to keep memory low on free tier
_PAGE_CACHE: dict[tuple[str, int], tuple[bytes, float]] = {}
_CACHE_TTL = 30 * 60  # 30 minutes in seconds
_MAX_CACHE_ENTRIES = 40  # ~40 pages max in memory at once


def _cache_get(question_id: str, page: int) -> bytes | None:
    key = (question_id, page)
    entry = _PAGE_CACHE.get(key)
    if not entry:
        return None
    data, ts = entry
    if time.time() - ts > _CACHE_TTL:
        del _PAGE_CACHE[key]
        return None
    return data


def _cache_set(question_id: str, page: int, data: bytes) -> None:
    # Evict oldest entries if at cap
    if len(_PAGE_CACHE) >= _MAX_CACHE_ENTRIES:
        oldest_key = min(_PAGE_CACHE, key=lambda k: _PAGE_CACHE[k][1])
        del _PAGE_CACHE[oldest_key]
    _PAGE_CACHE[(question_id, page)] = (data, time.time())


# ── Key normaliser ────────────────────────────────────────────────────────────

def _to_key(file_url: str) -> str:
    """
    Old uploads stored the full B2 URL; new ones store just the key.
    Always return a plain key so download_bytes works correctly.
    """
    if not file_url.startswith("http"):
        return file_url
    marker = f"/file/{B2_BUCKET}/"
    idx = file_url.find(marker)
    if idx != -1:
        return file_url[idx + len(marker):]
    parts = file_url.split(f"/{B2_BUCKET}/", 1)
    if len(parts) == 2:
        return parts[1]
    return file_url


# ── Auth helper ───────────────────────────────────────────────────────────────

async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> dict:
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

    profile = (
        supabase.table("profiles")
        .select("is_admin, admin_role")
        .eq("id", user.id)
        .single()
        .execute()
    )
    is_admin = False
    if profile and profile.data:
        is_admin = bool(
            profile.data.get("is_admin") or profile.data.get("admin_role")
        )

    return {"id": UUID(user.id), "is_admin": is_admin}


# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_question_record(question_id: str) -> dict:
    res = (
        supabase.table("past_questions")
        .select("id, file_url, mime_type, status, uploaded_by, extraction_quality")
        .eq("id", question_id)
        .single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return res.data


def _get_subscription(user_id: str) -> dict:
    res = (
        supabase.table("subscriptions")
        .select("status, plan")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if res and res.data:
        return {"is_paid": res.data[0].get("status") == "active"}
    return {"is_paid": False}


# ── Core render function (download + render all pages at once) ────────────────

def _render_all_pages(file_key: str, mime_type: str, question_id: str) -> int:
    """
    Downloads the file once, renders ALL pages to JPEG, caches them all.
    Returns total page count.
    This way B2 is only hit once no matter how many pages the student views.
    """
    file_bytes = download_bytes(file_key)

    # Guard: 15MB cap for free tier memory safety
    if len(file_bytes) > 15 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File too large to render on this plan.",
        )

    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="PDF rendering library not installed.",
            )

        pdf = pdfium.PdfDocument(file_bytes)
        total = len(pdf)

        for i in range(total):
            page_num = i + 1
            # Skip if already cached
            if _cache_get(question_id, page_num) is not None:
                continue
            page = pdf[i]
            bitmap = page.render(scale=150 / 72)
            pil_image = bitmap.to_pil()
            buf = io.BytesIO()
            pil_image.save(buf, format="JPEG", quality=82, optimize=True)
            _cache_set(question_id, page_num, buf.getvalue())

        return total

    else:
        # Single image file
        from PIL import Image
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        if img.width > 1600:
            ratio = 1600 / img.width
            img = img.resize((1600, int(img.height * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        _cache_set(question_id, 1, buf.getvalue())
        return 1


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get(
    "/{question_id}/page/{page_number}",
    summary="Stream a single rendered page image",
    response_class=Response,
)
async def get_page_image(
    question_id: str,
    page_number: int,
    user: dict = Depends(get_current_user),
):
    if page_number < 1:
        raise HTTPException(status_code=400, detail="Page number must be 1 or greater.")

    record = await run_in_threadpool(_get_question_record, question_id)

    if not user["is_admin"] and record["status"] != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    if not user["is_admin"]:
        sub = await run_in_threadpool(_get_subscription, str(user["id"]))
        if not sub["is_paid"] and page_number > FREE_PAGE_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free accounts can view the first {FREE_PAGE_LIMIT} pages only.",
            )

    # Check cache first — avoid B2 download if already rendered
    cached = _cache_get(question_id, page_number)
    if cached:
        return Response(
            content=cached,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
        )

    # Not cached — download and render ALL pages at once
    file_key = _to_key(record["file_url"])
    mime_type: str = record.get("mime_type") or "application/pdf"

    await run_in_threadpool(_render_all_pages, file_key, mime_type, question_id)

    jpeg_bytes = _cache_get(question_id, page_number)
    if not jpeg_bytes:
        raise HTTPException(status_code=404, detail=f"Page {page_number} not found.")

    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get(
    "/{question_id}/page-count",
    summary="Return the total page count for a paper",
)
async def get_page_count(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    record = await run_in_threadpool(_get_question_record, question_id)

    if not user["is_admin"] and record["status"] != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    file_key = _to_key(record["file_url"])
    mime_type: str = record.get("mime_type") or "application/pdf"

    # Render all pages now so subsequent /page/{n} requests are instant
    total = await run_in_threadpool(
        _render_all_pages, file_key, mime_type, question_id
    )

    sub = {"is_paid": True} if user["is_admin"] else await run_in_threadpool(
        _get_subscription, str(user["id"])
    )

    return {
        "total_pages": total,
        "viewable_pages": total if sub["is_paid"] else min(total, FREE_PAGE_LIMIT),
        "is_paid": sub["is_paid"],
    }


@router.get(
    "/{question_id}/admin-url",
    summary="Short-lived signed URL for admin preview only",
)
async def get_admin_signed_url(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required.")

    record = await run_in_threadpool(_get_question_record, question_id)
    file_key = _to_key(record["file_url"])

    signed_url = await run_in_threadpool(get_signed_url, file_key, SIGNED_URL_TTL)
    return {
        "url": signed_url,
        "expires_in": SIGNED_URL_TTL,
        "warning": "Admin only. Do not expose to students.",
    }