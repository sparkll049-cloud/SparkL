"""
routers/quiz.py
───────────────
AI-powered quiz generation with a shared Supabase cache pool.
Supports difficulty (easy | medium | hard), question count, and fresh mode.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
import time
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from google import genai
from google.genai import types

from app.supabase_client import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quiz", tags=["quiz"])

# ── Config ────────────────────────────────────────────────────────────────────
MIN_POOL        = 3
TARGET_POOL     = 10

GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL    = "gemini-3.1-flash-lite"   # stable since May 2026, fast + cheap
GEMINI_FALLBACK = "gemini-3.1-pro-preview"  # stronger fallback if lite fails

_gemini_client: genai.Client | None = (
    genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
)

# ── Difficulty instructions ───────────────────────────────────────────────────

DIFFICULTY_INSTRUCTIONS: dict[str, str] = {
    "easy": (
        "Generate EASY questions — straightforward recall of definitions, basic facts, "
        "and fundamental concepts. A student who read the material once should get most right."
    ),
    "medium": (
        "Generate MEDIUM difficulty questions — exam-level challenge. Mix direct recall with "
        "application and understanding. Typical of what appears in Nigerian university exams."
    ),
    "hard": (
        "Generate HARD questions — analytical, tricky distractors, multi-step reasoning. "
        "Push the student to think critically. Some questions should combine two concepts."
    ),
}

# ── System prompt ─────────────────────────────────────────────────────────────

def _build_system_prompt(difficulty: str, count: int) -> str:
    diff_instruction = DIFFICULTY_INSTRUCTIONS.get(difficulty, DIFFICULTY_INSTRUCTIONS["medium"])
    return f"""You are an expert Nigerian university exam question generator for SparkL, a student exam-prep platform.

Given a list of exam questions (theory or MCQ), generate {count} fresh multiple-choice questions
based on the same topics and concepts.

STRICT RULES:
1. DO NOT copy questions word-for-word — REPHRASE and reframe every question.
   Students may have already seen the originals; fresh wording is essential.
2. {diff_instruction}
3. Every question must have exactly 4 options (A–D) with only ONE correct answer.
4. Distractors must be plausible — not obviously wrong.
5. Write a clear 2–3 sentence explanation for each correct answer.
6. Vary question formats: definition, application, "which of the following", scenario-based.
7. Do NOT number the question_text itself — use question_number instead.
8. Return ONLY valid JSON — no markdown fences, no commentary, no preamble.

Output format:
{{
  "questions": [
    {{
      "question_number": 1,
      "question_text": "...",
      "options": {{ "a": "...", "b": "...", "c": "...", "d": "..." }},
      "correct_answer": "b",
      "explanation": "..."
    }}
  ]
}}"""

# ── Auth ──────────────────────────────────────────────────────────────────────

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

# ── Gemini call with fallback ─────────────────────────────────────────────────

def _clean_raw_response(raw: str) -> str:
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _call_gemini_sync(system_prompt: str, user_prompt: str) -> str:
    if not _gemini_client:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    for model in [GEMINI_MODEL, GEMINI_FALLBACK]:
        try:
            response = _gemini_client.models.generate_content(
                model=model,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.85,      # higher = more varied rephrasing each call
                    max_output_tokens=8000,
                ),
            )
            return response.text or ""
        except Exception as exc:
            err = str(exc)
            if "503" in err or "UNAVAILABLE" in err:
                logger.warning(
                    "Model %s unavailable, trying fallback %s...",
                    model, GEMINI_FALLBACK,
                )
                time.sleep(1)
                continue
            raise

    raise RuntimeError("All Gemini models unavailable. Try again later.")


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_processed_questions(question_id: str) -> list[dict]:
    result = (
        supabase.table("questions")
        .select(
            "question_number, question_text, question_type, "
            "option_a, option_b, option_c, option_d, correct_answer, model_answer"
        )
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )
    return result.data or []


async def _count_available(question_id: str, difficulty: str) -> int:
    result = (
        supabase.table("question_quiz_cache")
        .select("id", count="exact")
        .eq("question_id", question_id)
        .eq("difficulty", difficulty)
        .execute()
    )
    return result.count or 0


async def _generate_variant(
    question_id: str,
    processed_qs: list[dict],
    variant_index: int,
    difficulty: str,
    count: int,
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

    system_prompt = _build_system_prompt(difficulty, count)
    user_prompt = (
        f"Generate {count} fresh quiz questions (variant #{variant_index + 1}, "
        f"difficulty: {difficulty}) based on these source questions:\n\n{questions_payload}"
    )

    try:
        raw       = await run_in_threadpool(_call_gemini_sync, system_prompt, user_prompt)
        cleaned   = _clean_raw_response(raw)
        quiz_data = json.loads(cleaned)
    except Exception as exc:
        logger.error(
            "Quiz generation failed for %s variant %d: %s",
            question_id, variant_index, exc,
        )
        return None

    # Enforce count limit
    if "questions" in quiz_data and isinstance(quiz_data["questions"], list):
        quiz_data["questions"] = quiz_data["questions"][:count]

    try:
        supabase.table("question_quiz_cache").insert({
            "question_id":   question_id,
            "variant_index": variant_index,
            "difficulty":    difficulty,
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


async def _background_fill(question_id: str, difficulty: str, count: int) -> None:
    try:
        current = await _count_available(question_id, difficulty)
        needed  = TARGET_POOL - current
        if needed <= 0:
            return

        processed_qs = await _fetch_processed_questions(question_id)
        if not processed_qs:
            return

        for i in range(needed):
            await _generate_variant(question_id, processed_qs, current + i, difficulty, count)
            await asyncio.sleep(0.5)
    except Exception as exc:
        logger.error("Background fill error for %s: %s", question_id, exc)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{question_id}")
async def get_quiz(
    question_id: str,
    difficulty: Literal["easy", "medium", "hard"] = Query(default="medium"),
    count: int = Query(default=10, ge=1, le=20),
    fresh: bool = Query(default=False),
    user: dict = Depends(get_current_user),
):
    """
    Get or generate an AI quiz for a past question paper.

    - difficulty: easy | medium | hard  (default: medium)
    - count: number of questions 1–20   (default: 10; free users capped to 5 on frontend)
    - fresh: if True, skip cache and always generate a brand-new variant
    """
    quiz_data: dict | None = None
    chosen_id: str | None  = None
    variants: list[dict]   = []

    if not fresh:
        result = (
            supabase.table("question_quiz_cache")
            .select("id, quiz_json, used_count")
            .eq("question_id", question_id)
            .eq("difficulty", difficulty)
            .execute()
        )
        variants = result.data or []

    if variants and not fresh:
        # Pick the least-used variant so students get variety
        min_used   = min(v["used_count"] for v in variants)
        candidates = [v for v in variants if v["used_count"] == min_used]
        chosen     = random.choice(candidates)
        quiz_data  = chosen["quiz_json"]
        chosen_id  = chosen["id"]

        # Enforce requested count from cached data
        if quiz_data and "questions" in quiz_data:
            quiz_data = {**quiz_data, "questions": quiz_data["questions"][:count]}

        supabase.table("question_quiz_cache").update(
            {"used_count": chosen["used_count"] + 1}
        ).eq("id", chosen_id).execute()

    else:
        # Generate fresh — either cache was empty or fresh=True was requested
        processed_qs = await _fetch_processed_questions(question_id)

        if not processed_qs:
            raise HTTPException(
                status_code=404,
                detail="No processed questions found for this paper.",
            )

        variant_index = len(variants)  # next index after existing cached variants
        quiz_data = await _generate_variant(
            question_id, processed_qs, variant_index, difficulty, count
        )
        if not quiz_data:
            raise HTTPException(
                status_code=500,
                detail="Quiz generation failed. Please try again.",
            )

    # Background-fill the pool for this difficulty if running low
    current_count = len(variants) if variants else 1
    if current_count < MIN_POOL:
        asyncio.ensure_future(_background_fill(question_id, difficulty, count))

    return quiz_data


@router.post("/{question_id}/prefill")
async def prefill_quiz_cache(
    question_id: str,
    difficulty: Literal["easy", "medium", "hard"] = Query(default="medium"),
    count: int = Query(default=10, ge=1, le=20),
    user: dict = Depends(get_current_user),
):
    """Kick off background pool fill for a given paper and difficulty level."""
    asyncio.ensure_future(_background_fill(question_id, difficulty, count))
    return {"status": "fill_started", "question_id": question_id, "difficulty": difficulty}
