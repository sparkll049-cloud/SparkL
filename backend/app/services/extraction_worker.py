"""
extraction_worker.py
---------------------
Background worker that processes uploaded past-questions whose text
hasn't been extracted yet. Runs inside the same FastAPI process as an
asyncio loop, paced to stay under Gemini's free-tier rate limit — no
external queue/broker required.
"""

from __future__ import annotations

import asyncio
import logging

from app.supabase_client import supabase
from app.services.text_extractor import (
    extract_text,
    EmptyExtractionError,
    UnsupportedFileTypeError,
)
from app.services.text_quality import estimate_extraction_quality

logger = logging.getLogger("extraction_worker")

TABLE_NAME = "past_questions"
STORAGE_BUCKET = "past-questions"

# Gemini free tier allows ~10 requests/minute — pace at one call every
# 7 seconds to stay comfortably under that with some margin.
SECONDS_BETWEEN_CALLS = 7
# How long to wait when there's nothing to process, before checking again.
IDLE_POLL_SECONDS = 5


async def _process_one(record: dict) -> None:
    record_id = record["id"]
    file_url = record["file_url"]  # storage path
    mime_type = record.get("mime_type", "")

    # Reconstruct a plausible filename so extract_text can branch on
    # extension the same way it does at upload time.
    ext = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/png": ".png",
    }.get(mime_type, "")
    fake_filename = f"file{ext}"

    try:
        file_bytes = supabase.storage.from_(STORAGE_BUCKET).download(file_url)
    except Exception:
        logger.warning("Could not download file for record %s, skipping.", record_id)
        return

    try:
        result = extract_text(fake_filename, file_bytes)
    except (UnsupportedFileTypeError, EmptyExtractionError) as e:
        # Permanent failure for this file — mark it so we stop retrying
        # forever, but don't crash the worker loop.
        supabase.table(TABLE_NAME).update(
            {"extracted_text": f"[extraction failed: {e}]", "extraction_quality": 0}
        ).eq("id", record_id).execute()
        return
    except Exception:
        # Likely a transient error (rate limit, network) — leave the
        # record untouched so it gets picked up again next cycle.
        logger.warning("Extraction failed for record %s, will retry later.", record_id)
        return

    quality = estimate_extraction_quality(result.text)

    supabase.table(TABLE_NAME).update(
        {"extracted_text": result.text, "extraction_quality": quality}
    ).eq("id", record_id).execute()


async def run_extraction_worker() -> None:
    """Long-running loop — call this once at app startup as a background
    asyncio task. Never returns under normal operation."""
    while True:
        try:
            response = (
                supabase.table(TABLE_NAME)
                .select("id, file_url, mime_type")
                .is_("extracted_text", "null")
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )
            records = response.data or []

            if not records:
                await asyncio.sleep(IDLE_POLL_SECONDS)
                continue

            await _process_one(records[0])
            await asyncio.sleep(SECONDS_BETWEEN_CALLS)

        except Exception:
            logger.exception("Extraction worker loop error — retrying shortly.")
            await asyncio.sleep(IDLE_POLL_SECONDS)