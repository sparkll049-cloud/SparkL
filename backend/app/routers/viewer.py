"""
viewer.py
---------
Serves protected past-question content to students and admins.

Students never receive:
  - the original B2 key
  - a permanent URL
  - a raw PDF or image byte stream of the original

What they DO receive:
  - short-lived signed URLs for admins only (watermarked derivative)
  - server-rendered page images (for the page viewer)
  - structured question data (for practice mode — already handled in questions.py)
"""
from __future__ import annotations

import io
import os
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.supabase_client import supabase
from app.storage import download_bytes, get_signed_url

router = APIRouter(prefix="/api/questions", tags=["Viewer"])

# How many seconds a signed URL lives — admin preview only
SIGNED_URL_TTL = 300

# Free-tier page limit
FREE_PAGE_LIMIT = 2


# ── Auth helper (same pattern as uploads.py) ──────────────────────────────────

async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> dict:
    """Returns {"id": UUID, "is_admin": bool}"""
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

    # Check admin flag from profiles table
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
        row = res.data[0]
        is_paid = row.get("status") == "active"
        return {"is_paid": is_paid}
    return {"is_paid": False}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get(
    "/{question_id}/page/{page_number}",
    summary="Stream a single rendered page image — no raw file ever sent to browser",
    response_class=Response,
)
async def get_page_image(
    question_id: str,
    page_number: int,
    user: dict = Depends(get_current_user),
):
    """
    Renders the requested page of the stored PDF/image as a JPEG and streams
    it back. The original B2 key and file bytes never leave the server.

    Page numbers are 1-indexed.
    Free users are limited to the first FREE_PAGE_LIMIT pages.
    """
    if page_number < 1:
        raise HTTPException(status_code=400, detail="Page number must be 1 or greater.")

    record = await run_in_threadpool(_get_question_record, question_id)

    # Only approved papers are visible to students
    if not user["is_admin"] and record["status"] != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    # Enforce free-tier page cap
    if not user["is_admin"]:
        sub = await run_in_threadpool(_get_subscription, str(user["id"]))
        if not sub["is_paid"] and page_number > FREE_PAGE_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free accounts can view the first {FREE_PAGE_LIMIT} pages only.",
            )

    file_key: str = record["file_url"]
    mime_type: str = record.get("mime_type", "application/pdf")

    # Download original bytes server-side — never forwarded to client
    file_bytes = await run_in_threadpool(download_bytes, file_key)

    # Render the requested page to JPEG
    jpeg_bytes = await run_in_threadpool(
        _render_page_to_jpeg, file_bytes, mime_type, page_number
    )

    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={
            # No caching — each response is auth-gated
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
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

    file_key: str = record["file_url"]
    mime_type: str = record.get("mime_type", "application/pdf")
    file_bytes = await run_in_threadpool(download_bytes, file_key)

    total = await run_in_threadpool(_count_pages, file_bytes, mime_type)

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
    summary="Short-lived signed URL for admin preview only — never expose to students",
)
async def get_admin_signed_url(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required.")

    record = await run_in_threadpool(_get_question_record, question_id)
    file_key: str = record["file_url"]

    signed_url = await run_in_threadpool(get_signed_url, file_key, SIGNED_URL_TTL)
    return {
        "url": signed_url,
        "expires_in": SIGNED_URL_TTL,
        "warning": "Admin only. Do not expose to students.",
    }


# ── Page rendering helpers ────────────────────────────────────────────────────

def _render_page_to_jpeg(file_bytes: bytes, mime_type: str, page_number: int) -> bytes:
    """
    Convert one page of a PDF or image to JPEG bytes.
    Uses pypdfium2 for PDFs (fast, no poppler dependency needed on Render).
    Images are returned directly after optional resize.
    """
    if mime_type == "application/pdf":
        return _pdf_page_to_jpeg(file_bytes, page_number)
    else:
        return _image_to_jpeg(file_bytes)


def _pdf_page_to_jpeg(file_bytes: bytes, page_number: int) -> bytes:
    try:
        import pypdfium2 as pdfium
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF rendering library not installed. Run: pip install pypdfium2",
        )

    pdf = pdfium.PdfDocument(file_bytes)
    total = len(pdf)

    if page_number > total:
        raise HTTPException(
            status_code=404,
            detail=f"Page {page_number} does not exist. This paper has {total} pages.",
        )

    page = pdf[page_number - 1]  # 0-indexed
    # 150 DPI equivalent — readable but not high enough to be worth downloading
    bitmap = page.render(scale=150 / 72)
    pil_image = bitmap.to_pil()

    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()


def _image_to_jpeg(file_bytes: bytes) -> bytes:
    try:
        from PIL import Image
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Image library not installed. Run: pip install Pillow",
        )

    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    # Cap at 1600px wide — legible but not print-quality
    if img.width > 1600:
        ratio = 1600 / img.width
        img = img.resize((1600, int(img.height * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()


def _count_pages(file_bytes: bytes, mime_type: str) -> int:
    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(file_bytes)
            return len(pdf)
        except Exception:
            return 1
    return 1  # images are always 1 page