"""Gemini-only structured past-question processor."""
from __future__ import annotations

import json
import logging
import os
import re

from google import genai
from google.genai import types

logger = logging.getLogger("question_processor")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_TEXT_MODEL", os.getenv("GEMINI_VISION_MODEL", "gemini-3.5-flash"))
_gemini_client: genai.Client | None = (
    genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
)

# NOTE: filled with .replace(), NOT .format(), because the JSON example
# below contains literal braces.
PROCESS_PROMPT = """
You are converting an academic past examination paper into structured practice questions.
Return ONLY valid JSON: an array of objects. Do not use markdown or commentary.

Rules:
- Skip the paper header, institution name, course title, instructions, time allowed, and section headings.
- For theory questions: question_type='theory'; options and correct_answer must be null; write a study-oriented model_answer.
- For MCQs: question_type='mcq'; preserve all available options; correct_answer must be one of a, b, c, d only when supported by the paper; otherwise null.
- Keep theory sub-parts together in one question_text.
- Number sequentially across the whole paper.
- Do not invent missing questions, options, answers, marks, or explanations. Use null when the source does not support a field.
- topic_tag must be a short phrase or null.
- difficulty must be easy, medium, hard, or null.
- marks must be a whole number or null.

Required object shape:
[
  {
    "question_number": 1,
    "question_text": "...",
    "question_type": "theory",
    "option_a": null,
    "option_b": null,
    "option_c": null,
    "option_d": null,
    "correct_answer": null,
    "model_answer": "...",
    "explanation": "...",
    "topic_tag": "...",
    "difficulty": "medium",
    "marks": null
  }
]

Course: __COURSE__
Institution: __INSTITUTION__

Extracted paper text:
---
__TEXT__
---
"""


class ProcessingError(Exception):
    pass


def _clean_raw_response(raw: str) -> str:
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _to_int_or_none(value):
    if value is None or value == "":
        return None
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return None


def _validate_question(q: dict, index: int) -> dict:
    if not isinstance(q, dict):
        raise ProcessingError(f"Item {index} is not an object")
    for field in ("question_number", "question_text", "question_type"):
        if field not in q:
            raise ProcessingError(f"Item {index} is missing {field}")

    q["question_type"] = str(q["question_type"]).lower()
    if q["question_type"] not in {"theory", "mcq"}:
        q["question_type"] = "theory"
    q["question_number"] = int(q["question_number"])
    q["question_text"] = str(q["question_text"]).strip()
    if not q["question_text"]:
        raise ProcessingError(f"Item {index} has empty question_text")

    for field in (
        "option_a", "option_b", "option_c", "option_d", "correct_answer",
        "model_answer", "explanation", "topic_tag", "difficulty", "marks",
    ):
        q.setdefault(field, None)

    if q["question_type"] == "theory":
        for field in ("option_a", "option_b", "option_c", "option_d", "correct_answer"):
            q[field] = None
    elif q["correct_answer"] is not None:
        answer = str(q["correct_answer"]).strip().lower()
        q["correct_answer"] = answer if answer in {"a", "b", "c", "d"} else None

    if q["difficulty"] is not None:
        q["difficulty"] = str(q["difficulty"]).strip().lower()
    if q["difficulty"] not in {None, "easy", "medium", "hard"}:
        q["difficulty"] = None
    q["marks"] = _to_int_or_none(q["marks"])
    return q


def _parse(raw: str) -> list[dict]:
    try:
        data = json.loads(_clean_raw_response(raw))
    except json.JSONDecodeError as exc:
        raise ProcessingError(f"Gemini returned invalid JSON: {exc}") from exc

    # Some responses wrap the array: {"questions": [...]}
    if isinstance(data, dict):
        lists = [v for v in data.values() if isinstance(v, list)]
        data = lists[0] if lists else []

    if not isinstance(data, list) or not data:
        raise ProcessingError("Gemini returned no questions")

    result = []
    for index, item in enumerate(data):
        try:
            result.append(_validate_question(item, index))
        except (ProcessingError, TypeError, ValueError) as exc:
            logger.warning("Skipping malformed item %s: %s", index, exc)
    if not result:
        raise ProcessingError("No valid questions were returned")
    return result


def process_questions(extracted_text: str, course_name: str = "", institution: str = "") -> list[dict]:
    if not extracted_text or not extracted_text.strip():
        raise ProcessingError("extracted_text is empty")
    if not _gemini_client:
        raise ProcessingError("GEMINI_API_KEY is not configured")

    # Text goes in LAST so braces inside the paper are never re-scanned.
    prompt = (
        PROCESS_PROMPT
        .replace("__COURSE__", course_name or "not specified")
        .replace("__INSTITUTION__", institution or "not specified")
        .replace("__TEXT__", extracted_text.strip())
    )

    try:
        response = _gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
                max_output_tokens=16000,
            ),
        )
    except Exception as exc:
        logger.exception("Gemini call failed")
        raise ProcessingError(f"Gemini question processing failed: {exc}") from exc

    try:
        return _parse(response.text or "")
    except ProcessingError:
        raise
    except Exception as exc:
        raise ProcessingError(f"Could not read Gemini response: {exc}") from exc