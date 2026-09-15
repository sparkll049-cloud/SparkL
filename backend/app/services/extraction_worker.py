"""
extraction_worker.py
---------------------
Background worker that processes uploaded files whose text hasn't been
extracted yet. Now downloads from Backblaze B2 instead of Supabase Storage.
Runs inside the same FastAPI process as an asyncio loop.
"""
from __future__ import annotations

import asyncio
import logging

from app.supabase_client import supabase
from app.storage import get_signed_url
from app.services.text_extractor import (
    extract_text,
    EmptyExtractionError,
    UnsupportedFileTypeError,
)

logger = logging.getLogger("extraction_worker")

QUEUES = [
    "past_questions",
    "answer_submissions",
]

SECONDS_BETWEEN_CALLS = 7
IDLE_POLL_SECONDS     = 5


async def _download_from_b2(file_key: str) -> bytes:
    """Download file bytes from B2 using a presigned URL."""
    import httpx
    url = get_signed_url(file_key, expires_in=300)
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30)
        response.raise_for_status()
        return response.content


async def _process_one(table_name: str, record: dict) -> None:
    record_id = record["id"]
    file_key  = record["file_url"]
    mime_type = record.get("mime_type", "")

    ext = {
        "application/pdf": ".pdf",
        "image/jpeg":      ".jpg",
        "image/png":       ".png",
    }.get(mime_type, "")
    fake_filename = f"file{ext}"

    # Download from B2
    try:
        file_bytes = await _download_from_b2(file_key)
    except Exception as e:
        logger.warning(
            "Could not download file for %s record %s: %s — skipping.",
            table_name, record_id, e,
        )
        return

    # Extract text
    try:
        result = extract_text(fake_filename, file_bytes)
    except (UnsupportedFileTypeError, EmptyExtractionError) as e:
        # Mark as failed so admin knows — student already saw the error
        # at upload time via the pre-check, but this handles edge cases
        supabase.table(table_name).update({
            "extracted_text":    f"[extraction failed: {e}]",
            "extraction_quality": 0.0,
        }).eq("id", record_id).execute()
        return
    except Exception as e:
        logger.warning(
            "Extraction failed for %s record %s: %s — will retry later.",
            table_name, record_id, e,
        )
        return

    supabase.table(table_name).update({
        "extracted_text":    result.text,
        "extraction_quality": result.quality,
    }).eq("id", record_id).execute()

    logger.info(
        "Extracted text for %s %s — method: %s, quality: %.2f",
        table_name, record_id, result.method, result.quality,
    )


async def run_extraction_worker() -> None:
    logger.info("Extraction worker started.")
    while True:
        try:
            processed = False

            for table_name in QUEUES:
                response = (
                    supabase.table(table_name)
                    .select("id, file_url, mime_type")
                    .is_("extracted_text", "null")
                    .order("created_at", desc=False)
                    .limit(1)
                    .execute()
                )
                records = response.data or []

                if records:
                    await _process_one(table_name, records[0])
                    await asyncio.sleep(SECONDS_BETWEEN_CALLS)
                    processed = True
                    break

            if not processed:
                await asyncio.sleep(IDLE_POLL_SECONDS)

        except Exception:
            logger.exception("Extraction worker loop error — retrying shortly.")
            await asyncio.sleep(IDLE_POLL_SECONDS)