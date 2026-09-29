"""
page_tiles.py
-------------
Serves individual tile crops of a past-question page image.

GET /api/questions/{question_id}/page-count
    → { total_pages, viewable_pages }

GET /api/questions/{question_id}/page/{page}/tile/{row}/{col}
    → JPEG image (one tile of the grid)
    → 403 if the page is beyond the user's access limit

Grid is TILE_ROWS × TILE_COLS (default 3×3 = 9 tiles per page).
Each tile is fetched in parallel by the frontend and drawn onto a canvas —
the full page is never delivered as a single image, making OS-level
screenshot tools capture a blank or partial canvas instead of usable content.

Add to your FastAPI app:
    from app.routers.page_tiles import router as tiles_router
    app.include_router(tiles_router)
"""
from __future__ import annotations

import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.concurrency import run_in_threadpool

from app.supabase_client import supabase
from app.storage import get_signed_url          # your existing helper

router = APIRouter(prefix="/api/questions", tags=["Page Tiles"])

# ── Grid config ───────────────────────────────────────────────────────────────
TILE_ROWS = 3
TILE_COLS = 3

# Free-tier: how many pages a free user can see
FREE_PAGE_LIMIT = 2

# Signed URL TTL for the source image (seconds) — short, internal only
_SRC_URL_TTL = 60


# ── Auth helper ───────────────────────────────────────────────────────────────

async def _get_user_id(authorization: Optional[str] = Header(None)) -> UUID:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        resp = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user = getattr(resp, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return UUID(user.id)


# ── Subscription check ────────────────────────────────────────────────────────

def _is_paid(user_id: UUID) -> bool:
    """Return True if the user has an active paid subscription."""
    try:
        result = (
            supabase.table("subscriptions")
            .select("status")
            .eq("user_id", str(user_id))
            .eq("status", "active")
            .maybe_single()
            .execute()
        )
        return bool(result.data)
    except Exception:
        return False


# ── Page-count endpoint (unchanged interface) ─────────────────────────────────

@router.get("/{question_id}/page-count")
async def get_page_count(
    question_id: str,
    user_id: UUID = Depends(_get_user_id),
):
    """Return total_pages and viewable_pages for the question."""
    row = (
        supabase.table("past_questions")
        .select("id, page_count, file_url, status")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not row.data or row.data.get("status") != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    total = int(row.data.get("page_count") or 1)
    paid  = await run_in_threadpool(_is_paid, user_id)
    viewable = total if paid else min(total, FREE_PAGE_LIMIT)

    return {"total_pages": total, "viewable_pages": viewable, "is_paid": paid}


# ── Internal: fetch + crop a tile ────────────────────────────────────────────

def _fetch_source_image(file_url: str) -> bytes:
    """Download the full page image from storage."""
    import httpx
    url = get_signed_url(file_url, _SRC_URL_TTL)
    resp = httpx.get(url, timeout=15)
    resp.raise_for_status()
    return resp.content


def _crop_tile(
    image_bytes: bytes,
    page: int,
    total_pages: int,
    row: int,
    col: int,
    rows: int = TILE_ROWS,
    cols: int = TILE_COLS,
) -> bytes:
    """
    Crop a single tile from the page image.
    Returns JPEG bytes.
    """
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # If the source is a multi-page TIFF or PDF-rendered image, seek to page
    # (For single-page images this is a no-op.)
    try:
        img.seek(page - 1)
    except (AttributeError, EOFError):
        pass

    w, h = img.size
    tile_w = w // cols
    tile_h = h // rows

    left   = col * tile_w
    upper  = row * tile_h
    right  = left  + tile_w if col < cols - 1 else w   # last col gets remainder
    lower  = upper + tile_h if row < rows - 1 else h   # last row gets remainder

    tile = img.crop((left, upper, right, lower))

    buf = io.BytesIO()
    # Quality 82 — good sharpness, small size (~15-40 KB per tile)
    tile.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()


# ── Tile endpoint ─────────────────────────────────────────────────────────────

@router.get("/{question_id}/page/{page}/tile/{row}/{col}")
async def get_page_tile(
    question_id: str,
    page: int,
    row: int,
    col: int,
    user_id: UUID = Depends(_get_user_id),
):
    """
    Return a single JPEG tile (row, col) from the given page.
    row and col are 0-indexed.
    """
    # Validate grid bounds
    if not (0 <= row < TILE_ROWS and 0 <= col < TILE_COLS):
        raise HTTPException(status_code=400, detail="Invalid tile coordinates.")

    # Load question
    q_row = (
        supabase.table("past_questions")
        .select("id, page_count, file_url, status")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )
    if not q_row.data or q_row.data.get("status") != "approved":
        raise HTTPException(status_code=404, detail="Question not found.")

    total_pages = int(q_row.data.get("page_count") or 1)
    file_url    = q_row.data.get("file_url")

    if not file_url:
        raise HTTPException(status_code=404, detail="No file for this question.")

    # Enforce page access
    paid     = await run_in_threadpool(_is_paid, user_id)
    viewable = total_pages if paid else min(total_pages, FREE_PAGE_LIMIT)

    if page < 1 or page > total_pages:
        raise HTTPException(status_code=404, detail="Page not found.")
    if page > viewable:
        raise HTTPException(status_code=403, detail="Upgrade to access this page.")

    # Fetch full image and crop tile
    image_bytes = await run_in_threadpool(_fetch_source_image, file_url)
    tile_bytes  = await run_in_threadpool(
        _crop_tile, image_bytes, page, total_pages, row, col
    )

    return Response(
        content=tile_bytes,
        media_type="image/jpeg",
        headers={
            # Never cache — each request must be authenticated
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
        },
    )
