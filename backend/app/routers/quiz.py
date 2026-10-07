"""
routers/quiz.py
───────────────
AI-powered quiz generation with a shared Supabase cache pool.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from google import genai
from google.genai import types

from app.supabase_client import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quiz", tags=["quiz"])

# ── Config ────────────────────────────────────────────────────────────────────
MIN_POOL    = 3
TARGET_POOL = 10

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = os.getenv("GEMINI_TEXT_MODEL", os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash"))

_gemini_client: genai.Client | None = (
    genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
)

# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert Nigerian university exam question generator.
Given a list of exam questions (which may be theory or MCQ), convert EVERY question
into an interactive 4-option multiple-choice question.

Rules:
- For theory questions: create 4 plausible options (A-D). One must be correct.
  The wrong options should be realistic distractors, not obviously silly.
- For MCQ questions that already have options: you may reuse them, but SHUFFLE
  the order of options so correct_answer changes position each time.
- Keep question_text exactly as given. Do NOT summarise or rephrase questions.
- Each question must have: question_number, question_text, options (object with
  keys "a","b","c","d"), correct_answer (one of "a","b","c","d"), explanation
  (2-3 sentences explaining why the answer is correct).
- Return ONLY valid JSON — no markdown fences, no commentary.

Output format:
{
  "questions": [
    {
      "question_number": 1,
      "question_text": "...",
      "options": { "a": "...", "b": "...", "c": "...", "d": "..." },
      "correct_answer": "b",
      "explanation": "..."
    }
  ]
}
"""

# ── Auth (matches your questions.py pattern exactly) ──────────────────────────

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
    return {
        "id":    UUID(user.id),
        "email": user.email or str(user.id),
    }

# ── Gemini call (matches your question_processor.py pattern exactly) ──────────

def _clean_raw_response(raw: str) -> str:
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _call_gemini_sync(user_prompt: str) -> str:
    if not _gemini_client:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    full_prompt = f"{SYSTEM_PROMPT}\n\n{user_prompt}"

    response = _gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=full_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.7,   # higher than processor so variants differ
            max_output_tokens=8000,
        ),
    )
    return response.text or ""


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_processed_questions(question_id: str) -> list[dict]:
    result = (
        supabase.table("processed_questions")
        .select(
            "question_number, question_text, question_type, "
            "option_a, option_b, option_c, option_d, correct_answer, model_answer"
        )
        .eq("question_id", question_id)
        .order("question_number")
        .execute()
    )
    return result.data or []


async def _count_available(question_id: str) -> int:
    result = (
        supabase.table("question_quiz_cache")
        .select("id", count="exact")
        .eq("question_id", question_id)
        .execute()
    )
    return result.count or 0


async def _generate_variant(
    question_id: str,
    processed_qs: list[dict],
    variant_index: int,
) -> dict[str, Any] | None:
    questions_payload = json.dumps(
        [
            {
                "question_number": q["question_number"],
                "question_text":   q["question_text"],
                "question_type":   q["question_type"],
                "existing_options": {
                    "a":       q.get("option_a"),
                    "b":       q.get("option_b"),
                    "c":       q.get("option_c"),
                    "d":       q.get("option_d"),
                    "correct": q.get("correct_answer"),
                } if q["question_type"] == "mcq" else None,
                "model_answer": q.get("model_answer"),
            }
            for q in processed_qs
        ],
        ensure_ascii=False,
    )

    user_prompt = (
        f"Generate a quiz variant (variant #{variant_index + 1}) "
        f"for these questions:\n\n{questions_payload}"
    )

    try:
        raw       = await run_in_threadpool(_call_gemini_sync, user_prompt)
        cleaned   = _clean_raw_response(raw)
        quiz_data = json.loads(cleaned)
    except Exception as exc:
        logger.error(
            "Quiz generation failed for %s variant %d: %s",
            question_id, variant_index, exc,
        )
        return None

    try:
        supabase.table("question_quiz_cache").insert({
            "question_id":   question_id,
            "variant_index": variant_index,
            "quiz_json":     quiz_data,
            "used_count":    0,
        }).execute()
    except Exception as exc:
        logger.error(
            "Cache insert failed for %s variant %d: %s",
            question_id, variant_index, exc,
        )
        return None

    return quiz_data


async def _background_fill(question_id: str) -> None:
    try:
        current = await _count_available(question_id)
        needed  = TARGET_POOL - current
        if needed <= 0:
            return

        processed_qs = await _fetch_processed_questions(question_id)
        if not processed_qs:
            return

        for i in range(needed):
            await _generate_variant(question_id, processed_qs, current + i)
            await asyncio.sleep(0.5)
    except Exception as exc:
        logger.error("Background fill error for %s: %s", question_id, exc)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{question_id}")
async def get_quiz(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Return a quiz for the given question paper.
    Picks the least-used cached variant; generates one on-the-fly if none exist.
    Triggers a background pool fill if pool is running low.
    """
    result = (
        supabase.table("question_quiz_cache")
        .select("id, quiz_json, used_count")
        .eq("question_id", question_id)
        .execute()
    )
    variants: list[dict] = result.data or []

    quiz_data: dict | None = None
    chosen_id: str | None  = None

    if variants:
        min_used   = min(v["used_count"] for v in variants)
        candidates = [v for v in variants if v["used_count"] == min_used]
        chosen     = random.choice(candidates)
        quiz_data  = chosen["quiz_json"]
        chosen_id  = chosen["id"]

        supabase.table("question_quiz_cache").update(
            {"used_count": chosen["used_count"] + 1}
        ).eq("id", chosen_id).execute()

    else:
        # Cache miss — fetch from questions table (matches your actual table name)
        processed_qs = (
            supabase.table("questions")
            .select(
                "question_number, question_text, question_type, "
                "option_a, option_b, option_c, option_d, correct_answer, model_answer"
            )
            .eq("past_question_id", question_id)
            .order("question_number")
            .execute()
        ).data or []

        if not processed_qs:
            raise HTTPException(
                status_code=404,
                detail="No processed questions found for this paper.",
            )

        quiz_data = await _generate_variant(question_id, processed_qs, 0)
        if not quiz_data:
            raise HTTPException(
                status_code=500,
                detail="Quiz generation failed. Please try again.",
            )

    current_count = len(variants) if variants else 1
    if current_count < MIN_POOL:
        asyncio.ensure_future(_background_fill(question_id))

    return quiz_data


@router.post("/{question_id}/prefill")
async def prefill_quiz_cache(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Admin/cron endpoint: pre-fill the cache for a question paper.
    Call this after a paper is uploaded and processed.
    """
    asyncio.ensure_future(_background_fill(question_id))
    return {"status": "fill_started", "question_id": question_id}