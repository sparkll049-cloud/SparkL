"""
extraction_worker.py
---------------------
Background worker that processes uploaded files (past_questions and
answer_submissions) whose text hasn't been extracted yet. Runs inside
the same FastAPI process as an asyncio loop, paced to stay under
Gemini's free-tier rate limit — no external queue/broker required.
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

# (table_name, storage_bucket) pairs to process, checked in this order.
QUEUES = [
    ("past_questions", "past-questions"),
    ("answer_submissions", "answer-submissions"),
]

SECONDS_BETWEEN_CALLS = 7
IDLE_POLL_SECONDS = 5


async def _process_one(table_name: str, bucket: str, record: dict) -> None:
    record_id = record["id"]
    file_url = record["file_url"]
    mime_type = record.get("mime_type", "")

    ext = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/png": ".png",
    }.get(mime_type, "")
    fake_filename = f"file{ext}"

    try:
        file_bytes = supabase.storage.from_(bucket).download(file_url)
    except Exception:
        logger.warning("Could not download file for %s record %s, skipping.", table_name, record_id)
        return

    try:
        result = extract_text(fake_filename, file_bytes)
    except (UnsupportedFileTypeError, EmptyExtractionError) as e:
        supabase.table(table_name).update(
            {"extracted_text": f"[extraction failed: {e}]", "extraction_quality": 0}
        ).eq("id", record_id).execute()
        return
    except Exception:
        logger.warning("Extraction failed for %s record %s, will retry later.", table_name, record_id)
        return

    quality = estimate_extraction_quality(result.text)

    supabase.table(table_name).update(
        {"extracted_text": result.text, "extraction_quality": quality}
    ).eq("id", record_id).execute()


async def run_extraction_worker() -> None:
    while True:
        try:
            processed = False

            for table_name, bucket in QUEUES:
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
                    await _process_one(table_name, bucket, records[0])
                    await asyncio.sleep(SECONDS_BETWEEN_CALLS)
                    processed = True
                    break  # re-check from the top of QUEUES next loop

            if not processed:
                await asyncio.sleep(IDLE_POLL_SECONDS)

        except Exception:
            logger.exception("Extraction worker loop error — retrying shortly.")
            await asyncio.sleep(IDLE_POLL_SECONDS)
