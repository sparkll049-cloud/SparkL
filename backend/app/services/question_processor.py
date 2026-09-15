"""
question_processor.py
----------------------
Takes extracted_text from a past_question record and uses an LLM to
parse it into individual structured question rows.

Provider waterfall (tries in order until one succeeds):
  1. Gemini 2.5 Flash  — primary, best for vision/OCR-heavy text
  2. Groq qwen3-32b    — vision fallback
  3. Groq gpt-oss-120b — reasoning fallback (strongest backup)

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

from google import genai
from google.genai import types
from groq import Groq

logger = logging.getLogger("question_processor")

# ---------------------------------------------------------------------------
# Client initialisation
# ---------------------------------------------------------------------------

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")

_gemini_client: genai.Client | None = (
    genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
)
_groq_client: Groq | None = (
    Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
)

GEMINI_MODEL      = "gemini-3.6-flash"
GROQ_VISION_MODEL = "qwen/qwen3-32b"       # vision / general fallback
GROQ_REASON_MODEL = "openai/gpt-oss-120b"  # stronger reasoning fallback

# ---------------------------------------------------------------------------
# Prompt
# NOTE: All JSON example braces are doubled ({{ }}) to escape Python str.format().
# Only {extracted_text} stays single — it is the actual substitution placeholder.
# ---------------------------------------------------------------------------

PROCESS_PROMPT = """
You are processing a Nigerian university/polytechnic past examination question paper.

Your job is to extract every question into a structured JSON array.

Rules:
- Skip the paper header, institution name, course code/title, instructions, time allowed, and section headings.
- For THEORY questions (essay/short answer): set question_type to "theory", leave option_a–option_d as null, leave correct_answer as null, write a detailed model_answer.
- For MCQ questions: set question_type to "mcq", fill option_a–option_d, set correct_answer to the letter (a/b/c/d) of the correct option, write a brief explanation.
- For theory questions with sub-parts (a, b, c): treat the WHOLE question as one item. Include all sub-parts inside question_text, separated by newlines.
- question_number must be an integer (1, 2, 3...). Number sequentially across ALL sections — do NOT restart numbering per section.
- topic_tag: a short phrase (2–5 words) describing the concept tested (e.g. "Computer components", "Operating systems", "IPO cycle").
- model_answer: for theory, write a thorough answer a student could use to study. For MCQ, explain briefly why the correct option is right and why the others are wrong.
- difficulty: estimate as "easy", "medium", or "hard" based on depth of reasoning required.
- marks: extract the mark allocation if stated in the question (e.g. "(5 marks)"), otherwise null.
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


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ProcessingError(Exception):
    """Raised when all providers fail or return unusable output."""
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_prompt(extracted_text: str, course_name: str = "", institution: str = "") -> str:
    """Build the final prompt, injecting optional course/institution context."""
    context_lines = []
    if institution:
        context_lines.append(f"Institution: {institution}")
    if course_name:
        context_lines.append(f"Course: {course_name}")

    context_block = ""
    if context_lines:
        context_block = "Context about this paper:\n" + "\n".join(context_lines) + "\n\n"

    base = PROCESS_PROMPT.format(extracted_text=extracted_text.strip())
    return base.replace(
        "The extracted text from the paper is below:",
        context_block + "The extracted text from the paper is below:",
        1,
    )


def _clean_raw_response(raw: str) -> str:
    """Strip markdown fences and whitespace from any LLM output."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    # Some models wrap output in <think>...</think> reasoning blocks — strip them
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    return raw.strip()


def _parse_json_response(raw: str, provider: str) -> list[dict]:
    """Parse and basic-validate a raw JSON string from any provider."""
    raw = _clean_raw_response(raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ProcessingError(
            f"[{provider}] Invalid JSON: {e}\nRaw (first 500 chars): {raw[:500]}"
        ) from e

    if not isinstance(data, list):
        raise ProcessingError(
            f"[{provider}] Expected a JSON array, got {type(data).__name__}."
        )

    return data


def _validate_question(q: dict, index: int) -> dict:
    """
    Validate and normalise a single question dict.
    Fills missing optional fields and enforces types.
    Raises ProcessingError for fatally malformed entries.
    """
    required = {"question_number", "question_text", "question_type"}
    missing = required - q.keys()
    if missing:
        raise ProcessingError(
            f"Question at index {index} missing required fields: {missing}. Raw: {q}"
        )

    q_type = q.get("question_type", "").lower()
    if q_type not in {"theory", "mcq"}:
        logger.warning("Question %s has unknown type %r — defaulting to 'theory'.", index, q_type)
        q["question_type"] = "theory"

    for field in ("option_a", "option_b", "option_c", "option_d", "correct_answer", "model_answer"):
        q.setdefault(field, None)

    q.setdefault("explanation", None)
    q.setdefault("topic_tag", None)
    q.setdefault("difficulty", None)
    q.setdefault("marks", None)

    try:
        q["question_number"] = int(q["question_number"])
    except (ValueError, TypeError):
        logger.warning("Non-integer question_number at index %s: %r", index, q["question_number"])

    if q["correct_answer"] is not None:
        q["correct_answer"] = str(q["correct_answer"]).strip().lower()

    return q


def _post_process(questions: list[dict], provider: str) -> list[dict]:
    """Validate every question dict; skip malformed ones with a warning."""
    validated = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            logger.warning("[%s] Skipping non-dict item at index %s: %r", provider, i, q)
            continue
        try:
            validated.append(_validate_question(q, index=i))
        except ProcessingError as e:
            logger.warning("[%s] Skipping malformed question at index %s: %s", provider, i, e)

    if not validated:
        raise ProcessingError(f"[{provider}] No valid questions in response.")

    return validated


# ---------------------------------------------------------------------------
# Provider call functions
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str) -> list[dict]:
    """Call Gemini 2.5 Flash and return parsed questions."""
    if not _gemini_client:
        raise ProcessingError("[Gemini] Client not initialised — GEMINI_API_KEY missing.")

    logger.info("[Gemini] Sending request (%s).", GEMINI_MODEL)
    try:
        response = _gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
    except Exception as e:
        raise ProcessingError(f"[Gemini] API call failed: {e}") from e

    raw = response.text or ""
    if not raw.strip():
        raise ProcessingError("[Gemini] Empty response.")

    return _parse_json_response(raw, "Gemini")


def _call_groq(prompt: str, model: str, label: str) -> list[dict]:
    """
    Call a Groq-hosted model (streaming) and return parsed questions.
    Collects the full streamed response before parsing.
    """
    if not _groq_client:
        raise ProcessingError(f"[{label}] Groq client not initialised — GROQ_API_KEY missing.")

    logger.info("[%s] Sending request (%s).", label, model)

    is_reasoning = model == GROQ_REASON_MODEL
    params = dict(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=1 if is_reasoning else 0.6,
        max_completion_tokens=8192,
        top_p=1 if is_reasoning else 0.95,
        stream=True,
        stop=None,
    )
    if is_reasoning:
        params["reasoning_effort"] = "medium"

    try:
        completion = _groq_client.chat.completions.create(**params)
        chunks = []
        for chunk in completion:
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)
        raw = "".join(chunks)
    except Exception as e:
        raise ProcessingError(f"[{label}] API call failed: {e}") from e

    if not raw.strip():
        raise ProcessingError(f"[{label}] Empty response.")

    return _parse_json_response(raw, label)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def process_questions(
    extracted_text: str,
    course_name: str = "",
    institution: str = "",
) -> list[dict]:
    """
    Extract structured questions from raw paper text using an LLM.

    Tries providers in order — Gemini → Groq Vision → Groq Reasoning —
    and returns the first successful result. Raises ProcessingError only
    if every provider fails.

    Args:
        extracted_text: Raw OCR/extracted text from the past question paper.
        course_name:    Optional course name for additional context.
        institution:    Optional institution name for additional context.

    Returns:
        List of validated, normalised question dicts.

    Raises:
        ProcessingError: If all providers fail.
    """
    if not extracted_text or not extracted_text.strip():
        raise ProcessingError("extracted_text is empty — nothing to process.")

    prompt = _build_prompt(extracted_text, course_name=course_name, institution=institution)

    logger.info(
        "Processing %d characters. course=%r institution=%r",
        len(extracted_text),
        course_name or "—",
        institution or "—",
    )

    # Provider waterfall
    providers = [
        ("Gemini",       lambda: _call_gemini(prompt)),
        ("Groq-Vision",  lambda: _call_groq(prompt, GROQ_VISION_MODEL,  "Groq-Vision")),
        ("Groq-Reason",  lambda: _call_groq(prompt, GROQ_REASON_MODEL,  "Groq-Reason")),
    ]

    last_error: ProcessingError | None = None

    for name, call in providers:
        try:
            questions = call()
            validated = _post_process(questions, name)
            logger.info("[%s] Successfully extracted %d question(s).", name, len(validated))
            return validated
        except ProcessingError as e:
            logger.warning("[%s] Failed: %s — trying next provider.", name, e)
            last_error = e

    raise ProcessingError(
        f"All providers failed. Last error: {last_error}"
    )
