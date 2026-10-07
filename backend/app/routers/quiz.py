"""
routers/quiz.py
───────────────
AI-powered quiz generation with a shared Supabase cache pool.

Flow
────
1. Student hits GET /api/quiz/{question_id}
   → Backend checks question_quiz_cache for available (unused) variants
   → If ≥1 exists: return it and mark as used_count += 1
   → If none: generate one on-the-fly, save it, return it
   → Either way, if pool is now low (< MIN_POOL), trigger background fill

2. Background fill (asyncio task, not a separate worker):
   → Generates variants up to TARGET_POOL using Gemini
   → Each variant = every question in the paper converted to a 4-option MCQ
     with shuffled options + correct_answer + explanation

3. Cache row schema (question_quiz_cache table — see SQL below):
   id, question_id, variant_index, quiz_json (JSONB), used_count, created_at

SQL to run in Supabase:
────────────────────────
CREATE TABLE IF NOT EXISTS question_quiz_cache (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id    UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    variant_index  INTEGER NOT NULL DEFAULT 0,
    quiz_json      JSONB NOT NULL,
    used_count     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_cache_question ON question_quiz_cache(question_id, used_count);
"""

import asyncio
import json
import logging
import random
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

# Import your project's existing helpers
from ..dependencies import get_current_user, get_supabase          # adjust to your path
from ..services.ai import generate_with_gemini                      # adjust to your path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quiz", tags=["quiz"])

# ── Config ────────────────────────────────────────────────────────────────────
MIN_POOL    = 3   # trigger background fill when available variants < this
TARGET_POOL = 10  # fill up to this many variants per question

# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert Nigerian university exam question generator.
Given a list of exam questions (which may be theory or MCQ), convert EVERY question
into an interactive 4-option multiple-choice question.

Rules:
- For theory questions: create 4 plausible options (A–D). One must be correct.
  The wrong options should be realistic distractors, not obviously silly.
- For MCQ questions that already have options: you may reuse them, but SHUFFLE
  the order of options so correct_answer changes position each time.
- Keep question_text exactly as given. Do NOT summarise or rephrase questions.
- Each question must have: question_number, question_text, options (object with
  keys "a","b","c","d"), correct_answer (one of "a","b","c","d"), explanation
  (2–3 sentences explaining why the answer is correct).
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


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_processed_questions(question_id: str, supabase: Client) -> list[dict]:
    """Return processed questions for a paper from Supabase."""
    result = (
        supabase.table("processed_questions")
        .select("question_number, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, model_answer")
        .eq("question_id", question_id)
        .order("question_number")
        .execute()
    )
    return result.data or []


async def _count_available(question_id: str, supabase: Client) -> int:
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
    supabase: Client,
) -> dict[str, Any] | None:
    """Generate one quiz variant and save it to the cache. Returns the quiz dict."""
    questions_text = json.dumps(
        [
            {
                "question_number": q["question_number"],
                "question_text":   q["question_text"],
                "question_type":   q["question_type"],
                # Pass existing options so Gemini can shuffle them
                "existing_options": {
                    "a": q.get("option_a"),
                    "b": q.get("option_b"),
                    "c": q.get("option_c"),
                    "d": q.get("option_d"),
                    "correct": q.get("correct_answer"),
                } if q["question_type"] == "mcq" else None,
                "model_answer": q.get("model_answer"),
            }
            for q in processed_qs
        ],
        ensure_ascii=False,
    )

    user_prompt = f"Generate a quiz variant (variant #{variant_index + 1}) for these questions:\n\n{questions_text}"

    try:
        raw = await generate_with_gemini(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=4096,
        )
        # Strip any accidental markdown fences
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        quiz_data = json.loads(cleaned)
    except Exception as exc:
        logger.error("Quiz generation failed for %s variant %d: %s", question_id, variant_index, exc)
        return None

    try:
        supabase.table("question_quiz_cache").insert({
            "question_id":   question_id,
            "variant_index": variant_index,
            "quiz_json":     quiz_data,
            "used_count":    0,
        }).execute()
    except Exception as exc:
        logger.error("Cache insert failed for %s variant %d: %s", question_id, variant_index, exc)
        return None

    return quiz_data


async def _background_fill(question_id: str, supabase: Client) -> None:
    """Fill the cache pool up to TARGET_POOL in the background."""
    try:
        current = await _count_available(question_id, supabase)
        needed  = TARGET_POOL - current
        if needed <= 0:
            return

        processed_qs = await _fetch_processed_questions(question_id, supabase)
        if not processed_qs:
            return

        for i in range(needed):
            await _generate_variant(question_id, processed_qs, current + i, supabase)
            await asyncio.sleep(0.5)   # be gentle with the AI API
    except Exception as exc:
        logger.error("Background fill error for %s: %s", question_id, exc)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{question_id}")
async def get_quiz(
    question_id: str,
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Return a quiz for the given question paper.
    Picks a random cached variant; generates one on-the-fly if none exist.
    Triggers a background pool fill if pool is running low.
    """
    # 1. Fetch all available variants
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
        # Pick the least-used variant (with a bit of randomness among tied ones)
        min_used  = min(v["used_count"] for v in variants)
        candidates = [v for v in variants if v["used_count"] == min_used]
        chosen    = random.choice(candidates)
        quiz_data = chosen["quiz_json"]
        chosen_id = chosen["id"]

        # Increment used_count
        supabase.table("question_quiz_cache").update(
            {"used_count": chosen["used_count"] + 1}
        ).eq("id", chosen_id).execute()

    else:
        # Cache miss — generate one now
        processed_qs = await _fetch_processed_questions(question_id, supabase)
        if not processed_qs:
            raise HTTPException(status_code=404, detail="No processed questions found for this paper.")

        quiz_data = await _generate_variant(question_id, processed_qs, 0, supabase)
        if not quiz_data:
            raise HTTPException(status_code=500, detail="Quiz generation failed. Please try again.")

    # 2. Trigger background fill if pool is low
    current_count = len(variants) if variants else 1
    if current_count < MIN_POOL:
        asyncio.ensure_future(_background_fill(question_id, supabase))

    return quiz_data


@router.post("/{question_id}/prefill")
async def prefill_quiz_cache(
    question_id: str,
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Admin/cron endpoint: pre-fill the cache for a question paper.
    Can be called after a paper is uploaded and processed.
    """
    asyncio.ensure_future(_background_fill(question_id, supabase))
    return {"status": "fill_started", "question_id": question_id}
