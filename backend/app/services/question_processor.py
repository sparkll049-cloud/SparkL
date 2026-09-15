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
GEMINI_MODEL = "gemini-2.5-flash"

PROCESS_PROMPT = """
You are processing a Nigerian university/polytechnic past examination question paper.

Your job is to extract every question into a structured JSON array.

Rules:
- Skip the paper header, institution name, instructions, and section headings.
- For THEORY questions (essay/short answer): set question_type to "theory", leave option_a through option_d as null, leave correct_answer as null, write a detailed model_answer.
- For MCQ questions: set question_type to "mcq", fill option_a through option_d, set correct_answer to the letter (a/b/c/d) of the correct option, write a brief explanation.
- For theory questions with sub-parts (a, b, c): treat the WHOLE question as one item. Put the full question text including all sub-parts in question_text.
- question_number must be an integer (1, 2, 3...). Number sequentially across sections.
- topic_tag should be a short phrase describing what concept the question tests (e.g. "Computer components", "Operating systems", "IPO cycle").
- model_answer: for theory, write a thorough answer a student could use to study. For MCQ, write a brief explanation of why the correct answer is right.
- Return ONLY valid JSON. No markdown, no backticks, no commentary.

Output format:
[
  {
    "question_number": 1,
    "question_text": "full question text here including sub-parts if any",
    "question_type": "theory",
    "option_a": null,
    "option_b": null,
    "option_c": null,
    "option_d": null,
    "correct_answer": null,
    "model_answer": "detailed model answer here",
    "explanation": "brief explanation of key concepts tested",
    "topic_tag": "topic name"
  },
  {
    "question_number": 6,
    "question_text": "The physical components of a computer are called?",
    "question_type": "mcq",
    "option_a": "Software",
    "option_b": "Hardware",
    "option_c": "Data",
    "option_d": "Firmware",
    "correct_answer": "b",
    "model_answer": null,
    "explanation": "Hardware refers to the physical, tangible components of a computer such as the CPU, RAM, and storage devices.",
    "topic_tag": "Computer components"
  }
]

The extracted text from the paper is below:

{extracted_text}
"""


class ProcessingError(Exception):
    pass


def process_questions(
    extracted_text: str,
    course_name: str = "",
    institution: str = "",
) -> list[dict]:
    """
    Send extracted_text to Gemini and return a list of structured question dicts.
    Raises ProcessingError if Gemini fails or returns invalid JSON.
    """
    if not _client:
        raise ProcessingError("Gemini client not initialized — check GEMINI_API_KEY.")

    prompt = PROCESS_PROMPT.format(extracted_text=extracted_text.strip())

    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,  # low temp = consistent structured output
            ),
        )
    except Exception as e:
        raise ProcessingError(f"Gemini API call failed: {e}")

    raw = (response.text or "").strip()
    if not raw:
        raise ProcessingError("Gemini returned an empty response.")

    # Strip markdown fences if present (safety net)
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        questions = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ProcessingError(f"Gemini returned invalid JSON: {e}\nRaw: {raw[:300]}")

    if not isinstance(questions, list):
        raise ProcessingError("Expected a JSON array from Gemini.")

    return questions