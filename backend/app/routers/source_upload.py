# app/routers/source_upload.py
"""
Multi-course PDF upload.

Flow:
  1. POST /api/source-upload
         -> upload PDF to B2, create source_documents row
  2. GET  /api/source-upload/{id}/pages
         -> return page count so the frontend can render the mapping UI
  3. GET  /api/source-upload/{id}/page/{n}
         -> return a single page JPEG for the mapping UI thumbnails
  4. POST /api/source-upload/{id}/mapping
         -> save course->page-range assignments, validate for gaps/overlaps
  5. POST /api/source-upload/{id}/extract
         -> trigger one GitHub Actions run per section (fire and forget)
"""
from __future__ import annotations

import hashlib
import io
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

import httpx
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.routers.uploads import get_current_user_id
from app.admin_auth import get_current_admin
from app.storage import download_bytes, upload_bytes, upload_file
from app.supabase_client import supabase

router = APIRouter(prefix="/api/source-upload", tags=["Source Upload"])
logger = logging.getLogger("source_upload")

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_PAGES        = 200

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO  = os.getenv("GITHUB_REPO", "sparkll049-cloud/SparkL")

FILE_SIGNATURES = {
    b"%PDF-":               ("application/pdf", "pdf"),
    b"\xff\xd8\xff":        ("image/jpeg",      "jpg"),
    b"\x89PNG\r\n\x1a\n":  ("image/png",       "png"),
}

_IMG_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}


# ── Pydantic models ───────────────────────────────────────────────────────────

class SectionIn(BaseModel):
    course_id:  str
    start_page: int = Field(..., ge=1)
    end_page:   int = Field(..., ge=1)


class MappingPayload(BaseModel):
    sections: List[SectionIn] = Field(..., min_length=1)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_type(file_bytes: bytes) -> tuple[str, str]:
    for sig, (mime, ext) in FILE_SIGNATURES.items():
        if file_bytes.startswith(sig):
            return mime, ext
    raise HTTPException(
        status_code=415,
        detail="Only PDF, JPG, and PNG files are accepted.",
    )


def _check_uuid(value: str, label: str = "id") -> None:
    try:
        UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")


def _find_duplicate(file_hash: str) -> Optional[dict]:
    res = (
        supabase.table("source_documents")
        .select("id, status")
        .eq("file_hash", file_hash)
        .neq("status", "rejected")
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def _course_exists(course_id: str) -> bool:
    res = (
        supabase.table("courses")
        .select("id")
        .eq("id", course_id)
        .limit(1)
        .execute()
    )
    return bool(res and res.data)


def _load_course_context(course_id: str) -> tuple[str, str]:
    """Returns (course_name, institution_name)."""
    try:
        res = (
            supabase.table("courses")
            .select("name, department:departments(institution:institutions(name))")
            .eq("id", course_id)
            .limit(1)
            .execute()
        )
        row = (res.data or [None])[0] or {}
        course_name = row.get("name") or ""
        dept = row.get("department") or {}
        inst = dept.get("institution") or {}
        return course_name, inst.get("name") or ""
    except Exception:
        return "", ""


# ── Page count helpers ────────────────────────────────────────────────────────

def _count_pages_sync(file_bytes: bytes, mime_type: str) -> int:
    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(file_bytes)
            count = max(1, len(pdf))
            pdf.close()
            return count
        except Exception:
            try:
                from pypdf import PdfReader
                return max(1, len(PdfReader(io.BytesIO(file_bytes)).pages))
            except Exception:
                return 1
    return 1


def _render_page_sync(file_bytes: bytes, mime_type: str, page_num: int) -> bytes:
    from PIL import Image

    if mime_type == "application/pdf":
        try:
            import pypdfium2 as pdfium
        except ImportError:
            raise HTTPException(status_code=500, detail="pypdfium2 is not installed.")

        pdf = pdfium.PdfDocument(file_bytes)
        if page_num > len(pdf):
            pdf.close()
            raise HTTPException(status_code=404, detail=f"Page {page_num} does not exist.")
        img = pdf[page_num - 1].render(scale=96 / 72).to_pil().convert("RGB")
        pdf.close()
    else:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    max_w = 800
    if img.width > max_w:
        ratio = max_w / img.width
        img = img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    return buf.getvalue()


# ── Mapping validation ────────────────────────────────────────────────────────

def _validate_mapping(sections: List[SectionIn], total_pages: int) -> dict:
    errors   = []
    warnings = []

    for i, s in enumerate(sections):
        if s.end_page < s.start_page:
            errors.append(
                f"Section {i+1}: end_page ({s.end_page}) is before start_page ({s.start_page})."
            )
        if s.start_page < 1 or s.end_page > total_pages:
            errors.append(
                f"Section {i+1}: pages {s.start_page}-{s.end_page} out of range "
                f"(document has {total_pages} pages)."
            )

    for i in range(len(sections)):
        for j in range(i + 1, len(sections)):
            a, b = sections[i], sections[j]
            if a.start_page <= b.end_page and b.start_page <= a.end_page:
                errors.append(
                    f"Sections {i+1} and {j+1} overlap "
                    f"(pages {a.start_page}-{a.end_page} and {b.start_page}-{b.end_page})."
                )

    covered = set()
    for s in sections:
        covered.update(range(s.start_page, s.end_page + 1))
    unassigned = sorted(set(range(1, total_pages + 1)) - covered)
    if unassigned:
        groups, start = [], unassigned[0]
        prev = unassigned[0]
        for p in unassigned[1:]:
            if p != prev + 1:
                groups.append(f"{start}-{prev}" if start != prev else str(start))
                start = p
            prev = p
        groups.append(f"{start}-{prev}" if start != prev else str(start))
        warnings.append(f"Unassigned pages: {', '.join(groups)}.")

    return {"errors": errors, "warnings": warnings}


# ── GitHub Actions trigger ────────────────────────────────────────────────────

async def trigger_section_extraction(
    section_id: str,
    file_key: str,
    mime_type: str,
    start_page: int,
    end_page: int,
    course_id: str,
    course_name: str = "",
    institution: str = "",
):
    if not GITHUB_TOKEN:
        logger.warning("GITHUB_TOKEN not set — skipping GitHub trigger for section %s", section_id)
        return
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/extract.yml/dispatches",
                headers={
                    "Authorization": f"Bearer {GITHUB_TOKEN}",
                    "Accept": "application/vnd.github+json",
                },
                json={
                    "ref": "main",
                    "inputs": {
                        "record_id":   "",               # not used in section mode
                        "section_id":  section_id,
                        "file_key":    file_key,
                        "mime_type":   mime_type,
                        "start_page":  str(start_page),
                        "end_page":    str(end_page),
                        "course_id":   course_id,
                        "course_name": course_name,
                        "institution": institution,
                    },
                },
                timeout=10,
            )
            if res.status_code != 204:
                logger.error(
                    "GitHub section trigger failed: %s %s", res.status_code, res.text
                )
            else:
                logger.info("GitHub extraction triggered for section %s", section_id)
    except Exception as e:
        logger.error("GitHub section trigger error: %s", e)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_source_document(
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user_id),
):
    """Step 1 — Upload the PDF. Stores in B2, creates a source_documents row."""
    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum is {MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )

    mime_type, ext = _detect_type(file_bytes)

    file_hash = hashlib.sha256(file_bytes).hexdigest()
    duplicate = await run_in_threadpool(_find_duplicate, file_hash)
    if duplicate:
        raise HTTPException(status_code=409, detail="This file has already been uploaded.")

    page_count = await run_in_threadpool(_count_pages_sync, file_bytes, mime_type)
    if page_count > MAX_PAGES:
        raise HTTPException(
            status_code=400,
            detail=f"PDF has {page_count} pages. Maximum allowed is {MAX_PAGES}.",
        )

    file_key = await run_in_threadpool(
        lambda: upload_file(
            file_bytes=file_bytes,
            user_id=str(user_id),
            mime_type=mime_type,
            ext=ext,
        )
    )

    record = {
        "uploader_id": str(user_id),
        "file_key":    file_key,
        "mime_type":   mime_type,
        "file_size":   len(file_bytes),
        "file_hash":   file_hash,
        "page_count":  page_count,
        "status":      "pending",
    }
    res = supabase.table("source_documents").insert(record).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save upload record.")

    return res.data[0]


@router.get("/{source_id}/pages")
async def get_page_count(
    source_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """Step 2 — Return total page count for the mapping UI."""
    _check_uuid(source_id, "source_id")
    res = (
        supabase.table("source_documents")
        .select("id, page_count, uploader_id, status")
        .eq("id", source_id)
        .maybe_single()
        .execute()
    )
    row = res.data
    if not row:
        raise HTTPException(status_code=404, detail="Source document not found.")
    if row["uploader_id"] != str(user_id):
        raise HTTPException(status_code=403, detail="Not your document.")
    return {"source_id": source_id, "page_count": row["page_count"]}


@router.get("/{source_id}/page/{page_num}", response_class=Response)
async def get_page_thumbnail(
    source_id: str,
    page_num: int,
    user_id: UUID = Depends(get_current_user_id),
):
    """Step 2b — Return a single page JPEG thumbnail for the mapping UI."""
    _check_uuid(source_id, "source_id")

    res = (
        supabase.table("source_documents")
        .select("id, file_key, mime_type, page_count, uploader_id")
        .eq("id", source_id)
        .maybe_single()
        .execute()
    )
    row = res.data
    if not row:
        raise HTTPException(status_code=404, detail="Source document not found.")
    if row["uploader_id"] != str(user_id):
        raise HTTPException(status_code=403, detail="Not your document.")
    if page_num < 1 or (row["page_count"] and page_num > row["page_count"]):
        raise HTTPException(status_code=400, detail="Invalid page number.")

    file_bytes = await run_in_threadpool(download_bytes, row["file_key"])
    jpeg = await run_in_threadpool(
        _render_page_sync, file_bytes, row["mime_type"], page_num
    )
    return Response(content=jpeg, media_type="image/jpeg", headers=_IMG_HEADERS)


@router.post("/{source_id}/mapping")
async def save_mapping(
    source_id: str,
    payload: MappingPayload,
    user_id: UUID = Depends(get_current_user_id),
):
    """Step 3 — Save course->page-range assignments with overlap/range validation."""
    _check_uuid(source_id, "source_id")

    res = (
        supabase.table("source_documents")
        .select("id, page_count, uploader_id, status")
        .eq("id", source_id)
        .maybe_single()
        .execute()
    )
    row = res.data
    if not row:
        raise HTTPException(status_code=404, detail="Source document not found.")
    if row["uploader_id"] != str(user_id):
        raise HTTPException(status_code=403, detail="Not your document.")

    total_pages = row["page_count"] or 0
    if total_pages == 0:
        raise HTTPException(status_code=400, detail="Page count not available yet.")

    for i, s in enumerate(payload.sections):
        _check_uuid(s.course_id, f"section {i+1} course_id")
        exists = await run_in_threadpool(_course_exists, s.course_id)
        if not exists:
            raise HTTPException(
                status_code=400,
                detail=f"Section {i+1}: course_id {s.course_id} not found.",
            )

    validation = _validate_mapping(payload.sections, total_pages)
    if validation["errors"]:
        return {
            "saved":    False,
            "errors":   validation["errors"],
            "warnings": validation["warnings"],
        }

    supabase.table("course_document_sections") \
        .delete() \
        .eq("source_document_id", source_id) \
        .execute()

    rows = [
        {
            "source_document_id": source_id,
            "course_id":          s.course_id,
            "start_page":         s.start_page,
            "end_page":           s.end_page,
            "processing_status":  "pending",
        }
        for s in payload.sections
    ]
    supabase.table("course_document_sections").insert(rows).execute()

    return {
        "saved":    True,
        "errors":   [],
        "warnings": validation["warnings"],
        "sections": len(rows),
    }


@router.post("/{source_id}/extract")
async def extract_sections(
    source_id: str,
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Step 4 — Trigger one GitHub Actions run per section.
    Each run downloads the full PDF, slices to the section's page range,
    extracts text, processes questions, and saves everything to Supabase.
    Returns immediately; processing happens asynchronously in GitHub Actions.
    """
    _check_uuid(source_id, "source_id")

    src = (
        supabase.table("source_documents")
        .select("id, file_key, mime_type, uploader_id")
        .eq("id", source_id)
        .maybe_single()
        .execute()
    ).data
    if not src:
        raise HTTPException(status_code=404, detail="Source document not found.")
    if src["uploader_id"] != str(user_id):
        raise HTTPException(status_code=403, detail="Not your document.")

    sections = (
        supabase.table("course_document_sections")
        .select("id, start_page, end_page, course_id")
        .eq("source_document_id", source_id)
        .execute()
    ).data or []

    if not sections:
        raise HTTPException(
            status_code=400,
            detail="No sections found. Save the page mapping first.",
        )

    import asyncio

    triggered = []
    for sec in sections:
        # Mark as queued so the frontend can poll status
        supabase.table("course_document_sections").update({
            "processing_status": "uploaded",
            "processing_error":  None,
        }).eq("id", sec["id"]).execute()

        # Look up course name and institution for the worker prompt
        course_name, institution = await run_in_threadpool(
            _load_course_context, sec["course_id"]
        )

        # Fire and forget — one Actions run per section
        asyncio.create_task(trigger_section_extraction(
            section_id=sec["id"],
            file_key=src["file_key"],
            mime_type=src["mime_type"],
            start_page=sec["start_page"],
            end_page=sec["end_page"],
            course_id=sec["course_id"],
            course_name=course_name,
            institution=institution,
        ))
        triggered.append(sec["id"])
        logger.info(
            "Queued section %s (pages %d-%d)",
            sec["id"], sec["start_page"], sec["end_page"],
        )

    return {
        "source_id": source_id,
        "triggered": len(triggered),
        "section_ids": triggered,
    }
