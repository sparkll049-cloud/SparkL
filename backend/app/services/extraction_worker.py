"""
extraction_worker.py
---------------------
Background worker that processes uploaded past questions.
Runs inside the same FastAPI process as an asyncio loop.

past_questions lifecycle (processing_status):
    uploaded   -> waiting in the queue
    extracting -> claimed by this worker
    ready      -> text extracted (and questions generated, once wired in)
    failed     -> gave up; the student/admin can hit "Retry"

Safety features:
    * Atomic claim, so two runs never work on the same paper
    * Up to MAX_ATTEMPTS tries with exponential backoff (a bad file no longer
      blocks the queue by being retried every 7 seconds forever)
    * Papers stuck in 'extracting' (e.g. after a Render restart) are re-queued
    * Blocking work (Gemini, Supabase) runs in a threadpool, not the event loop
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi.concurrency import run_in_threadpool

from app.supabase_client import supabase
from app.storage import get_signed_url
from app.services.text_extractor import (
    extract_text,
    EmptyExtractionError,
    UnsupportedFileTypeError,
)

from app.services.question_processor import process_questions, ProcessingError

logger = logging.getLogger("extraction_worker")

# Columns of the `questions` table that the LLM output maps onto
QUESTION_COLUMNS = (
    "question_number", "question_text", "question_type",
    "option_a", "option_b", "option_c", "option_d",
    "correct_answer", "model_answer", "explanation",
    "topic_tag", "difficulty", "marks",
)

SECONDS_BETWEEN_CALLS = 7
IDLE_POLL_SECONDS     = 5
MAX_ATTEMPTS          = 3
STALE_AFTER_MINUTES   = 15
STALE_SWEEP_SECONDS   = 60

_EXT_BY_MIME = {
    "application/pdf": ".pdf",
    "image/jpeg":      ".jpg",
    "image/png":       ".png",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ts(dt: datetime) -> str:
    # 'Z' format is safe inside PostgREST filters ('+' would be misread)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


async def _download_from_b2(file_key: str) -> bytes:
    url = get_signed_url(file_key, expires_in=300)
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30)
        response.raise_for_status()
        return response.content


# ── Database helpers (sync — always called through run_in_threadpool) ─────────

def _sweep_stale() -> None:
    cutoff = _ts(_now() - timedelta(minutes=STALE_AFTER_MINUTES))
    (
        supabase.table("past_questions")
        .update({"processing_status": "uploaded"})
        .eq("processing_status", "extracting")
        .lt("processing_started_at", cutoff)
        .execute()
    )


def _next_candidate() -> dict | None:
    now = _ts(_now())
    res = (
        supabase.table("past_questions")
        .select("id, file_url, mime_type, extracted_text, processing_attempts")
        .eq("processing_status", "uploaded")
        .or_(f"processing_next_at.is.null,processing_next_at.lte.{now}")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    rows = res.data if res else None
    return rows[0] if rows else None


def _claim(record_id: str, attempts: int) -> bool:
    res = (
        supabase.table("past_questions")
        .update(
            {
                "processing_status":     "extracting",
                "processing_started_at": _ts(_now()),
                "processing_attempts":   attempts + 1,
            }
        )
        .eq("id", record_id)
        .eq("processing_status", "uploaded")  # atomic: only one claimer wins
        .execute()
    )
    return bool(res and res.data)


def _save_text(record_id: str, text: str, quality: float) -> None:
    (
        supabase.table("past_questions")
        .update({"extracted_text": text, "extraction_quality": quality})
        .eq("id", record_id)
        .execute()
    )


def _mark_ready(record_id: str) -> None:
    (
        supabase.table("past_questions")
        .update(
            {
                "processing_status": "ready",
                "processing_error":  None,
                "processing_next_at": None,
            }
        )
        .eq("id", record_id)
        .execute()
    )


def _mark_failed(record_id: str, error: str, quality: float | None = None) -> None:
    update = {"processing_status": "failed", "processing_error": error[:500]}
    if quality is not None:
        update["extraction_quality"] = quality
    supabase.table("past_questions").update(update).eq("id", record_id).execute()


def _retry_or_fail(record_id: str, attempts_used: int, error: str) -> None:
    if attempts_used >= MAX_ATTEMPTS:
        _mark_failed(record_id, error)
        return
    backoff_minutes = 2 ** attempts_used  # 2, 4 ...
    (
        supabase.table("past_questions")
        .update(
            {
                "processing_status":  "uploaded",
                "processing_error":   error[:500],
                "processing_next_at": _ts(_now() + timedelta(minutes=backoff_minutes)),
            }
        )
        .eq("id", record_id)
        .execute()
    )


# ── Question generation hook ──────────────────────────────────────────────────

def _questions_exist(record_id: str) -> bool:
    res = (
        supabase.table("questions")
        .select("id")
        .eq("past_question_id", record_id)
        .limit(1)
        .execute()
    )
    return bool(res and res.data)


def _load_context(record_id: str) -> tuple[str, str]:
    """Course and institution names give the LLM useful context."""
    try:
        res = (
            supabase.table("past_questions")
            .select(
                "course:courses(name, "
                "department:departments(institution:institutions(name)))"
            )
            .eq("id", record_id)
            .limit(1)
            .execute()
        )
        row = (res.data or [None])[0] or {}
        course = row.get("course") or {}
        dept = course.get("department") or {}
        inst = dept.get("institution") or {}
        return course.get("name") or "", inst.get("name") or ""
    except Exception:
        try:  # nested join not available — fall back to the course name only
            res = (
                supabase.table("past_questions")
                .select("course:courses(name)")
                .eq("id", record_id)
                .limit(1)
                .execute()
            )
            row = (res.data or [None])[0] or {}
            return (row.get("course") or {}).get("name") or "", ""
        except Exception:
            return "", ""


def _insert_questions(record_id: str, questions: list[dict]) -> None:
    rows = [
        {**{col: q.get(col) for col in QUESTION_COLUMNS}, "past_question_id": record_id}
        for q in questions
    ]
    supabase.table("questions").insert(rows).execute()  # one batch = all or nothing


async def _generate_questions(record_id: str, text: str) -> None:
    """
    Turn the extracted text into rows in the `questions` table.
    Skips papers that already have questions (safe to retry). Raises on
    failure so the paper is retried with backoff.
    """
    if await run_in_threadpool(_questions_exist, record_id):
        return

    course_name, institution = await run_in_threadpool(_load_context, record_id)

    try:
        questions = await run_in_threadpool(
            process_questions, text, course_name, institution
        )
    except ProcessingError:
        raise  # handled by the retry logic in _process_past_question

    await run_in_threadpool(_insert_questions, record_id, questions)
    logger.info("Saved %d questions for %s.", len(questions), record_id)


# ── past_questions ────────────────────────────────────────────────────────────

async def _process_past_question(record: dict) -> bool:
    """Returns True if a paper was actually processed (so the caller paces calls)."""
    record_id = record["id"]
    attempts  = record.get("processing_attempts") or 0

    if not await run_in_threadpool(_claim, record_id, attempts):
        return False  # someone else got it
    attempts_used = attempts + 1

    text = record.get("extracted_text")

    try:
        # 1) Text: the upload route may already have extracted it
        if not text:
            ext = _EXT_BY_MIME.get(record.get("mime_type", ""), "")
            file_bytes = await _download_from_b2(record["file_url"])
            result = await run_in_threadpool(extract_text, f"file{ext}", file_bytes)
            text = result.text
            await run_in_threadpool(_save_text, record_id, result.text, result.quality)
            logger.info(
                "Extracted %s — method: %s, quality: %.2f",
                record_id, result.method, result.quality,
            )

        # 2) Questions
        await _generate_questions(record_id, text)

        await run_in_threadpool(_mark_ready, record_id)

    except (UnsupportedFileTypeError, EmptyExtractionError) as e:
        # Retrying won't help — the file itself is unreadable
        await run_in_threadpool(_mark_failed, record_id, f"Unreadable file: {e}", 0.0)
    except Exception as e:
        logger.warning(
            "Processing failed for %s (attempt %d/%d): %s",
            record_id, attempts_used, MAX_ATTEMPTS, e,
        )
        await run_in_threadpool(_retry_or_fail, record_id, attempts_used, str(e))

    return True


# ── answer_submissions (unchanged behaviour: text-only queue) ────────────────

def _next_submission() -> dict | None:
    res = (
        supabase.table("answer_submissions")
        .select("id, file_url, mime_type")
        .is_("extracted_text", "null")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    rows = res.data if res else None
    return rows[0] if rows else None


def _update_submission(record_id: str, text: str, quality: float) -> None:
    (
        supabase.table("answer_submissions")
        .update({"extracted_text": text, "extraction_quality": quality})
        .eq("id", record_id)
        .execute()
    )


async def _process_submission(record: dict) -> bool:
    record_id = record["id"]
    ext = _EXT_BY_MIME.get(record.get("mime_type", ""), "")

    try:
        file_bytes = await _download_from_b2(record["file_url"])
    except Exception as e:
        logger.warning("Could not download submission %s: %s — skipping.", record_id, e)
        return False

    try:
        result = await run_in_threadpool(extract_text, f"file{ext}", file_bytes)
    except (UnsupportedFileTypeError, EmptyExtractionError) as e:
        await run_in_threadpool(_update_submission, record_id, f"[extraction failed: {e}]", 0.0)
        return True
    except Exception as e:
        logger.warning("Extraction failed for submission %s: %s — will retry later.", record_id, e)
        return False

    await run_in_threadpool(_update_submission, record_id, result.text, result.quality)
    return True


# ── Main loop ─────────────────────────────────────────────────────────────────

async def run_extraction_worker() -> None:
    logger.info("Extraction worker started.")
    last_sweep = 0.0

    while True:
        try:
            loop_time = asyncio.get_event_loop().time()
            if loop_time - last_sweep >= STALE_SWEEP_SECONDS:
                await run_in_threadpool(_sweep_stale)
                last_sweep = loop_time

            processed = False

            record = await run_in_threadpool(_next_candidate)
            if record:
                processed = await _process_past_question(record)

            if not processed:
                submission = await run_in_threadpool(_next_submission)
                if submission:
                    processed = await _process_submission(submission)

            await asyncio.sleep(SECONDS_BETWEEN_CALLS if processed else IDLE_POLL_SECONDS)

        except Exception:
            logger.exception("Extraction worker loop error — retrying shortly.")
            await asyncio.sleep(IDLE_POLL_SECONDS)
