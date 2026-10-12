"""
routers/quiz.py
───────────────
AI-powered quiz generation with a shared Supabase cache pool.

Modes:
  fresh=False → rotate cached variants, least-used first.
                Background-fill pool when running low.
  fresh=True  → generate brand-new questions every time,
                skip cache entirely, do NOT save to cache.

Correct answer is always reshuffled after generation so it is
never stuck on option A.
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
GEMINI_MODEL    = "gemini-3.1-flash-lite"   # GA May 2026
GEMINI_FALLBACK = "gemini-3.1-pro-preview"  # stronger fallback

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

# ── Format rotations — keeps questions feeling different across sessions ───────

FORMAT_ROTATIONS = [
    "Focus on definitions and direct recall: 'What is X?' and 'Which of the following defines Y?'",
    "Focus on application and examples: 'Which scenario best illustrates X?' and 'A student does Y — what concept applies?'",
    "Focus on comparisons: 'What is the difference between X and Y?' and 'Which of the following is NOT a feature of Z?'",
    "Focus on cause-and-effect: 'Why does X happen?' and 'What would result if Y occurred?'",
]

# ── System prompt ─────────────────────────────────────────────────────────────

def _build_system_prompt(difficulty: str, count: int, rotation: int = 0) -> str:
    diff_instruction   = DIFFICULTY_INSTRUCTIONS.get(
        difficulty, DIFFICULTY_INSTRUCTIONS["medium"]
    )
    format_instruction = FORMAT_ROTATIONS[rotation % len(FORMAT_ROTATIONS)]

    return f"""You are an expert Nigerian university exam question generator for SparkL, a student exam-prep platform.

Given source exam questions, generate {count} completely FRESH multiple-choice questions
covering the same topics and concepts — but written in entirely new words every time.

STRICT RULES:
1. NEVER copy any question word-for-word from the source material.
   Every question must use different sentence structure, different wording,
   and a different angle from the original. Students have already seen the originals —
   your job is to make them think, not recognise.
2. {diff_instruction}
3. {format_instruction}
4. Every question must have exactly 4 options (A, B, C, D) with only ONE correct answer.
5. Distractors must be plausible and require thought — not obviously wrong.
6. Write a clear, helpful 2–3 sentence explanation for each correct answer.
7. Do NOT number the question_text itself — use question_number instead.
8. Return ONLY valid JSON — no markdown fences, no preamble, no commentary.

Output format (strict):
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

# ── Gemini call ───────────────────────────────────────────────────────────────

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
                    temperature=0.92,
                    max_output_tokens=8000,
                ),
            )
            return response.text or ""
        except Exception as exc:
            err = str(exc)
            if "503" in err or "UNAVAILABLE" in err or "not found" in err.lower():
                logger.warning("Model %s unavailable, trying fallback...", model)
                time.sleep(1)
                continue
            raise

    raise RuntimeError("All Gemini models unavailable. Try again later.")

# ── Option reshuffler ─────────────────────────────────────────────────────────

def _reshuffle_options(questions: list[dict]) -> list[dict]:
    """
    Randomly reorder options A-D for every question and update correct_answer
    to match the new position. Guarantees the correct answer is never always A.
    Called after every generation — both fresh and cached variants.
    """
    keys = ["a", "b", "c", "d"]
    reshuffled = []

    for q in questions:
        opts    = q.get("options") or {}
        correct = (q.get("correct_answer") or "a").lower().strip()

        # Build (old_key, text) pairs for all four slots
        pairs = [(k, opts.get(k, "")) for k in keys]

        # Need all four options present to reshuffle safely
        if len(pairs) < 4 or any(text == "" for _, text in pairs):
            reshuffled.append(q)
            continue

        # Remember the correct answer text so we can track it after shuffle
        correct_text = opts.get(correct, "")

        # Shuffle
        random.shuffle(pairs)

        # Rebuild options dict and find the new key for the correct answer
        new_opts    = {}
        new_correct = correct  # fallback — should always be overwritten below

        for new_key, (_, text) in zip(keys, pairs):
            new_opts[new_key] = text
            if text == correct_text:
                new_correct = new_key

        reshuffled.append({
            **q,
            "options":        new_opts,
            "correct_answer": new_correct,
        })

    return reshuffled

# ── Source questions fetch ────────────────────────────────────────────────────

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


def _build_questions_payload(processed_qs: list[dict]) -> str:
    return json.dumps(
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

# ── Generate fresh (no cache) ─────────────────────────────────────────────────

async def _generate_fresh(
    processed_qs: list[dict],
    difficulty: str,
    count: int,
    rotation: int,
) -> dict[str, Any]:
    """
    Generate brand-new questions without touching the cache at all.
    Called when fresh=True. High temperature + rotating format instruction
    ensures every call produces genuinely different questions.
    Options are reshuffled after generation so correct answer is randomised.
    """
    questions_payload = _build_questions_payload(processed_qs)
    system_prompt     = _build_system_prompt(difficulty, count, rotation)
    user_prompt       = (
        f"Generate {count} completely fresh MCQ questions "
        f"(difficulty: {difficulty}, session seed: {rotation}) "
        f"based on these source questions. "
        f"Make every question feel new — different wording, different angle:\n\n"
        f"{questions_payload}"
    )

    raw     = await run_in_threadpool(_call_gemini_sync, system_prompt, user_prompt)
    cleaned = _clean_raw_response(raw)
    data    = json.loads(cleaned)

    if "questions" in data and isinstance(data["questions"], list):
        data["questions"] = _reshuffle_options(data["questions"][:count])

    return data

# ── Generate and cache (for pool building) ────────────────────────────────────

async def _generate_and_cache(
    question_id: str,
    processed_qs: list[dict],
    variant_index: int,
    difficulty: str,
    count: int,
) -> dict[str, Any] | None:
    """
    Generate a variant, reshuffle its options, and save it to the cache pool.
    Called for background pool filling and cache-miss scenarios.
    """
    rotation          = variant_index % len(FORMAT_ROTATIONS)
    questions_payload = _build_questions_payload(processed_qs)
    system_prompt     = _build_system_prompt(difficulty, count, rotation)
    user_prompt       = (
        f"Generate {count} fresh quiz questions "
        f"(variant #{variant_index + 1}, difficulty: {difficulty}, "
        f"format rotation: {rotation}) "
        f"based on these source questions:\n\n{questions_payload}"
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

    if "questions" in quiz_data and isinstance(quiz_data["questions"], list):
        # Reshuffle before caching so stored variants are already randomised
        quiz_data["questions"] = _reshuffle_options(
            quiz_data["questions"][:count]
        )

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


async def _count_cached(question_id: str, difficulty: str) -> int:
    result = (
        supabase.table("question_quiz_cache")
        .select("id", count="exact")
        .eq("question_id", question_id)
        .eq("difficulty", difficulty)
        .execute()
    )
    return result.count or 0


async def _background_fill(question_id: str, difficulty: str, count: int) -> None:
    try:
        current = await _count_cached(question_id, difficulty)
        needed  = TARGET_POOL - current
        if needed <= 0:
            return

        processed_qs = await _fetch_processed_questions(question_id)
        if not processed_qs:
            return

        for i in range(needed):
            await _generate_and_cache(
                question_id, processed_qs, current + i, difficulty, count
            )
            await asyncio.sleep(0.6)
    except Exception as exc:
        logger.error("Background fill error for %s: %s", question_id, exc)

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{question_id}")
async def get_quiz(
    question_id: str,
    difficulty: Literal["easy", "medium", "hard"] = Query(default="medium"),
    count:      int  = Query(default=10, ge=1, le=20),
    fresh:      bool = Query(default=False),
    user: dict = Depends(get_current_user),
):
    """
    Get or generate an AI quiz for a past question paper.

    - difficulty : easy | medium | hard  (default: medium)
    - count      : 1–20 questions        (default: 10)
    - fresh      : True  → always generate brand-new questions, skip cache
                   False → rotate through cached variants, least-used first
    """

    # Always fetch source questions first — needed for both paths
    processed_qs = await _fetch_processed_questions(question_id)
    if not processed_qs:
        raise HTTPException(
            status_code=404,
            detail="No processed questions found for this paper.",
        )

    # ── fresh=True: generate live, never touch cache ──────────────────────────
    if fresh:
        rotation = random.randint(0, len(FORMAT_ROTATIONS) - 1)
        try:
            quiz_data = await _generate_fresh(
                processed_qs, difficulty, count, rotation
            )
        except Exception as exc:
            logger.error("Fresh generation failed for %s: %s", question_id, exc)
            raise HTTPException(
                status_code=500,
                detail="Quiz generation failed. Please try again.",
            )
        return quiz_data

    # ── fresh=False: try cache first ──────────────────────────────────────────
    result   = (
        supabase.table("question_quiz_cache")
        .select("id, quiz_json, used_count")
        .eq("question_id", question_id)
        .eq("difficulty", difficulty)
        .execute()
    )
    variants = result.data or []

    if variants:
        # Pick the least-used variant for variety
        min_used   = min(v["used_count"] for v in variants)
        candidates = [v for v in variants if v["used_count"] == min_used]
        chosen     = random.choice(candidates)
        quiz_data  = chosen["quiz_json"]
        chosen_id  = chosen["id"]

        # Enforce requested count from cached data
        if quiz_data and "questions" in quiz_data:
            # Reshuffle again on serve so repeated views of the same
            # cached variant still get randomised option order
            qs = _reshuffle_options(quiz_data["questions"][:count])
            quiz_data = {**quiz_data, "questions": qs}

        supabase.table("question_quiz_cache").update(
            {"used_count": chosen["used_count"] + 1}
        ).eq("id", chosen_id).execute()

    else:
        # Cache empty — generate and store one variant synchronously
        variant_index = 0
        quiz_data     = await _generate_and_cache(
            question_id, processed_qs, variant_index, difficulty, count
        )
        if not quiz_data:
            raise HTTPException(
                status_code=500,
                detail="Quiz generation failed. Please try again.",
            )

    # Background-fill the pool if running low
    current_count = len(variants) if variants else 1
    if current_count < MIN_POOL:
        asyncio.ensure_future(
            _background_fill(question_id, difficulty, count)
        )

    return quiz_data


@router.post("/{question_id}/prefill")
async def prefill_quiz_cache(
    question_id: str,
    difficulty: Literal["easy", "medium", "hard"] = Query(default="medium"),
    count: int = Query(default=10, ge=1, le=20),
    user: dict = Depends(get_current_user),
):
    """Kick off background pool fill for a given paper and difficulty level."""
    asyncio.ensure_future(
        _background_fill(question_id, difficulty, count)
    )
    return {
        "status":      "fill_started",
        "question_id": question_id,
        "difficulty":  difficulty,
    }