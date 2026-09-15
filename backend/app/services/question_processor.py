"""
question_processor.py
----------------------
Takes extracted_text from a past_question record and uses Gemini to
parse it into individual structured question rows.

Handles:
- Theory questions with sub-parts (a, b, c)
- MCQ questions with A/B/C/D options
- Mixed papers (Section A theory + Section B MCQ)
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

from google import genai
from google.genai import types

logger = logging.getLogger("question_processor")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
GEMINI_MODEL = "gemini-3.6-flash"

# NOTE: All JSON example braces are doubled ({{ }}) to escape Python's str.format().
# Only {extracted_text} is single — it is the actual substitution placeholder.
PROCESS_PROMPT = """
You are processing a Nigerian university/polytechnic past examination question paper.

Your job is to extract every question into a structured JSON array.

Rules:
- Skip the paper header, institution name, course code/title, instructions, time allowed, and section headings.
- For THEORY questions (essay/short answer): set question_type to "theory", leave option_a through option_d as null, leave correct_answer as null, write a detailed model_answer.
- For MCQ questions: set question_type to "mcq", fill option_a through option_d, set correct_answer to the letter (a/b/c/d) of the correct option, write a brief explanation.
- For theory questions with sub-parts (a, b, c): treat the WHOLE question as one item. Include all sub-parts inside question_text, separated by newlines.
- question_number must be an integer (1, 2, 3...). Number sequentially across all sections — do NOT restart numbering per section.
- topic_tag should be a short phrase (2–5 words) describing the concept tested (e.g. "Computer components", "Operating systems", "IPO cycle").
- model_answer: for theory, write a thorough answer a student could use to study. For MCQ, explain briefly why the correct option is right and why the others are wrong.
- difficulty: estimate as "easy", "medium", or "hard" based on the depth of reasoning required.
- marks: extract the mark allocation if stated in the question (e.g. "(5 marks)"), otherwise set to null.
- Return ONLY valid JSON. No markdown, no backticks, no commentary before or after.

Output format:
[
  {{
    "question_number": 1,
    "question_text": "full question text here, including all sub-parts if any",
    "question_type": "theory",
    "option_a": null,
    "option_b": null,
    "option_c": null,
    "option_d": null,
    "correct_answer": null,
    "model_answer": "detailed model answer here",
    "explanation": "brief explanation of key concepts tested",
    "topic_tag": "topic name",
    "difficulty": "medium",
    "marks": 10
  }},
  {{
    "question_number": 6,
    "question_text": "The physical components of a computer are called?",
    "question_type": "mcq",
    "option_a": "Software",
    "option_b": "Hardware",
    "option_c": "Data",
    "option_d": "Firmware",
    "correct_answer": "b",
    "model_answer": null,
    "explanation": "Hardware refers to the physical, tangible components of a computer such as the CPU, RAM, and storage devices. Software (a) is intangible. Data (c) is input/output. Firmware (d) is embedded software, not a general term for physical components.",
    "topic_tag": "Computer components",
    "difficulty": "easy",
    "marks": null
  }}
]

The extracted text from the paper is below:
---
{extracted_text}
---
"""


class ProcessingError(Exception):
    """Raised when Gemini processing fails or returns unusable output."""
    pass


def _build_prompt(extracted_text: str, course_name: str = "", institution: str = "") -> str:
    """Build the final prompt, optionally injecting course/institution context."""
    context_lines = []
    if institution:
        context_lines.append(f"Institution: {institution}")
    if course_name:
        context_lines.append(f"Course: {course_name}")

    context_block = ""
    if context_lines:
        context_block = "Context about this paper:\n" + "\n".join(context_lines) + "\n\n"

    base = PROCESS_PROMPT.format(extracted_text=extracted_text.strip())
    # Insert context just before the extracted text section
    return base.replace(
        "The extracted text from the paper is below:",
        context_block + "The extracted text from the paper is below:",
        1,
    )


def _clean_raw_response(raw: str) -> str:
    """Strip markdown fences and leading/trailing whitespace from Gemini output."""
    raw = raw.strip()
    # Remove ```json ... ``` or ``` ... ``` fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _validate_question(q: dict, index: int) -> dict:
    """
    Validate and normalise a single question dict.
    Fills in missing optional fields and enforces types.
    Raises ProcessingError for fatally malformed entries.
    """
    required = {"question_number", "question_text", "question_type"}
    missing = required - q.keys()
    if missing:
        raise ProcessingError(
            f"Question at index {index} is missing required fields: {missing}. Raw: {q}"
        )

    q_type = q.get("question_type", "").lower()
    if q_type not in {"theory", "mcq"}:
        logger.warning("Question %s has unknown type %r — defaulting to 'theory'.", index, q_type)
        q["question_type"] = "theory"

    # Ensure all option/answer fields exist (null for theory questions)
    for field in ("option_a", "option_b", "option_c", "option_d", "correct_answer", "model_answer"):
        q.setdefault(field, None)

    # Ensure optional enrichment fields exist
    q.setdefault("explanation", None)
    q.setdefault("topic_tag", None)
    q.setdefault("difficulty", None)
    q.setdefault("marks", None)

    # Coerce question_number to int if Gemini returned a string
    try:
        q["question_number"] = int(q["question_number"])
    except (ValueError, TypeError):
        logger.warning("Non-integer question_number at index %s: %r", index, q["question_number"])

    # Normalise correct_answer to lowercase single letter
    if q["correct_answer"] is not None:
        q["correct_answer"] = str(q["correct_answer"]).strip().lower()

    return q


def process_questions(
    extracted_text: str,
    course_name: str = "",
    institution: str = "",
) -> list[dict]:
    """
    Send extracted_text to Gemini and return a list of structured question dicts.

    Args:
        extracted_text: Raw OCR/extracted text from the past question paper.
        course_name:    Optional course name for additional context.
        institution:    Optional institution name for additional context.

    Returns:
        List of question dicts, each validated and normalised.

    Raises:
        ProcessingError: If the Gemini client is unavailable, the API call fails,
                         or the response cannot be parsed into a valid question list.
    """
    if not _client:
        raise ProcessingError("Gemini client not initialised — check GEMINI_API_KEY env var.")

    if not extracted_text or not extracted_text.strip():
        raise ProcessingError("extracted_text is empty — nothing to process.")

    prompt = _build_prompt(extracted_text, course_name=course_name, institution=institution)

    logger.info(
        "Sending %d characters to Gemini (%s). course=%r institution=%r",
        len(extracted_text),
        GEMINI_MODEL,
        course_name or "—",
        institution or "—",
    )

    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,  # Low temperature for consistent structured output
            ),
        )
    except Exception as e:
        raise ProcessingError(f"Gemini API call failed: {e}") from e

    raw = response.text or ""
    if not raw.strip():
        raise ProcessingError("Gemini returned an empty response.")

    raw = _clean_raw_response(raw)

    try:
        questions = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ProcessingError(
            f"Gemini returned invalid JSON: {e}\n"
            f"Raw output (first 500 chars): {raw[:500]}"
        ) from e

    if not isinstance(questions, list):
        raise ProcessingError(
            f"Expected a JSON array from Gemini, got {type(questions).__name__}."
        )

    if not questions:
        logger.warning("Gemini returned an empty question list.")
        return []

    validated = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            logger.warning("Skipping non-dict item at index %s: %r", i, q)
            continue
        try:
            validated.append(_validate_question(q, index=i))
        except ProcessingError as e:
            logger.warning("Skipping malformed question at index %s: %s", i, e)

    if not validated:
        raise ProcessingError(
            "No valid questions could be extracted from Gemini's response."
        )

    logger.info("Successfully extracted %d question(s).", len(validated))
    return validated
