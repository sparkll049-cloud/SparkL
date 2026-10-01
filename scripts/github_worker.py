"""
scripts/github_worker.py
Runs inside GitHub Actions. Downloads PDF from B2, extracts text,
processes questions, updates Supabase. No FastAPI dependency.

Two modes:
  single  — processes one past_questions record  (RECORD_ID is set)
  section — processes one course_document_sections record (SECTION_ID is set)
"""
from __future__ import annotations

import io
import json
import logging
import os
import random
import re
import sys
import time
from datetime import datetime, timezone

import boto3
from botocore.client import Config
from google import genai
from google.genai import errors, types
from pypdf import PdfReader, PdfWriter
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("github_worker")

# ── Env ───────────────────────────────────────────────────────────────────────

# Single mode
RECORD_ID  = os.environ.get("RECORD_ID", "")

# Section mode
SECTION_ID = os.environ.get("SECTION_ID", "")
START_PAGE = int(os.environ.get("START_PAGE", "0") or "0")
END_PAGE   = int(os.environ.get("END_PAGE",   "0") or "0")
COURSE_ID  = os.environ.get("COURSE_ID", "")

# Shared
FILE_KEY    = os.environ["FILE_KEY"]
MIME_TYPE   = os.environ["MIME_TYPE"]
COURSE_NAME = os.environ.get("COURSE_NAME", "")
INSTITUTION = os.environ.get("INSTITUTION", "")

MODE = "section" if SECTION_ID else "single"

GEMINI_API_KEY      = os.environ["GEMINI_API_KEY"]
GEMINI_VISION_MODEL = os.environ.get("GEMINI_VISION_MODEL", "gemini-3.5-flash")
GEMINI_TEXT_MODEL   = os.environ.get("GEMINI_TEXT_MODEL",   "gemini-3.5-flash")
FALLBACK_MODEL      = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-3.1-flash-lite")

B2_ENDPOINT = os.environ["B2_ENDPOINT"]
B2_KEY_ID   = os.environ["B2_KEY_ID"]
B2_APP_KEY  = os.environ["B2_APP_KEY"]
B2_BUCKET   = os.environ.get("B2_BUCKET_NAME", "sparkl-questions")

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# ── Clients ───────────────────────────────────────────────────────────────────

def _b2():
    endpoint = B2_ENDPOINT if B2_ENDPOINT.startswith("http") else f"https://{B2_ENDPOINT}"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=B2_KEY_ID,
        aws_secret_access_key=B2_APP_KEY,
        config=Config(signature_version="s3v4"),
    )

def _supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

gemini = genai.Client(api_key=GEMINI_API_KEY)

# ── Gemini retry helper ───────────────────────────────────────────────────────

def generate_with_retry(primary_model, contents, config, attempts: int = 4):
    """Exponential backoff on 429/5xx; falls back to FALLBACK_MODEL on 404."""
    models = [primary_model]
    if FALLBACK_MODEL and FALLBACK_MODEL != primary_model:
        models.append(FALLBACK_MODEL)

    last_err = None
    for model in models:
        for i in range(attempts):
            try:
                return gemini.models.generate_content(
                    model=model, contents=contents, config=config
                )
            except errors.APIError as e:
                code = getattr(e, "code", None)
                last_err = e
                if code == 404:
                    logger.warning("%s not available (404), trying next model", model)
                    break
                if code in (429, 500, 503, 504):
                    wait = min(60, 3 * 2 ** i) + random.random()
                    logger.warning(
                        "%s got %s, retry %d/%d in %.0fs",
                        model, code, i + 1, attempts, wait,
                    )
                    time.sleep(wait)
                    continue
                raise
    raise last_err

# ── B2 helpers ────────────────────────────────────────────────────────────────

def download_from_b2(key: str) -> bytes:
    logger.info("Downloading %s from B2", key)
    response = _b2().get_object(Bucket=B2_BUCKET, Key=key)
    return response["Body"].read()

def get_signed_url(key: str, expires_in: int = 300) -> str:
    return _b2().generate_presigned_url(
        "get_object",
        Params={"Bucket": B2_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )

# ── PDF slicing ───────────────────────────────────────────────────────────────

def slice_pdf(file_bytes: bytes, start_page: int, end_page: int) -> bytes:
    """Extract pages start_page..end_page (1-indexed, inclusive) into a new PDF."""
    reader = PdfReader(io.BytesIO(file_bytes))
    writer = PdfWriter()
    total = len(reader.pages)
    logger.info("Slicing pages %d–%d from %d total pages", start_page, end_page, total)
    for page_num in range(start_page - 1, min(end_page, total)):
        writer.add_page(reader.pages[page_num])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()

# ── Text extraction ───────────────────────────────────────────────────────────

def _score_text(text: str) -> float:
    if not text:
        return 0.0
    words = text.split()
    if len(words) < 10:
        return 0.1
    clean = sum(1 for w in words if any(c.isalpha() for c in w))
    ratio = clean / len(words)
    if ratio > 0.7: return 1.0
    if ratio > 0.4: return 0.6
    return 0.3

def _strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

def _extract_pdf_native(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = [(p.extract_text() or "").strip() for p in reader.pages]
        return "\n\n".join(p for p in pages if p).strip()
    except Exception as e:
        logger.warning("pypdf failed: %s", e)
        return ""

def _gemini_vision(file_bytes: bytes, mime_type: str) -> str:
    response = generate_with_retry(
        GEMINI_VISION_MODEL,
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            (
                "This is an academic past-examination paper. Extract all readable text. "
                "Preserve page order, question numbering, options, mathematical notation, "
                "tables, and section structure. Do not summarize or add commentary. "
                "Return only the transcription. If a region cannot be read, write [unreadable section]."
            ),
        ],
        config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=12000),
    )
    return _strip_thinking((response.text or "").strip())

def extract_text(file_bytes: bytes, mime_type: str) -> tuple[str, float]:
    """Returns (text, quality_score)"""
    if mime_type == "application/pdf":
        native = _extract_pdf_native(file_bytes)
        score  = _score_text(native)
        if native and score >= 0.4:
            logger.info("Using native PDF extraction, quality=%.2f", score)
            return native, score
        logger.info("Native quality low (%.2f), falling back to Gemini vision", score)
        vision = _gemini_vision(file_bytes, mime_type)
        if vision:
            return vision, _score_text(vision)
        if native:
            return native, score
        raise RuntimeError("Could not extract text from PDF")
    else:
        vision = _gemini_vision(file_bytes, mime_type)
        if not vision:
            raise RuntimeError("Could not extract text from image")
        return vision, _score_text(vision)

# ── Question processing ───────────────────────────────────────────────────────

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

def _to_int_or_none(v):
    if v is None or v == "": return None
    try: return int(float(str(v).strip()))
    except: return None

def _validate_question(q: dict, i: int) -> dict:
    q["question_type"] = str(q.get("question_type", "theory")).lower()
    if q["question_type"] not in {"theory", "mcq"}:
        q["question_type"] = "theory"
    q["question_number"] = int(q.get("question_number", i + 1))
    q["question_text"]   = str(q.get("question_text", "")).strip()
    if not q["question_text"]:
        raise ValueError(f"Item {i} has empty question_text")
    for f in ("option_a","option_b","option_c","option_d","correct_answer",
              "model_answer","explanation","topic_tag","difficulty","marks"):
        q.setdefault(f, None)
    if q["question_type"] == "theory":
        for f in ("option_a","option_b","option_c","option_d","correct_answer"):
            q[f] = None
    elif q["correct_answer"] is not None:
        ans = str(q["correct_answer"]).strip().lower()
        q["correct_answer"] = ans if ans in {"a","b","c","d"} else None
    if q["difficulty"] not in {None,"easy","medium","hard"}:
        q["difficulty"] = None
    q["marks"] = _to_int_or_none(q["marks"])
    return q

def process_questions(text: str, course_name: str, institution: str) -> list[dict]:
    prompt = (
        PROCESS_PROMPT
        .replace("__COURSE__", course_name or "not specified")
        .replace("__INSTITUTION__", institution or "not specified")
        .replace("__TEXT__", text.strip())
    )
    response = generate_with_retry(
        GEMINI_TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,
            max_output_tokens=16000,
        ),
    )
    raw = re.sub(r"^```(?:json)?\s*", "", (response.text or "")).strip()
    raw = re.sub(r"\s*```$", "", raw).strip()
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    data = json.loads(raw)
    if isinstance(data, dict):
        lists = [v for v in data.values() if isinstance(v, list)]
        data  = lists[0] if lists else []
    if not isinstance(data, list) or not data:
        raise RuntimeError("Gemini returned no questions")

    result = []
    for i, item in enumerate(data):
        try:
            result.append(_validate_question(item, i))
        except Exception as e:
            logger.warning("Skipping item %d: %s", i, e)
    if not result:
        raise RuntimeError("No valid questions parsed")
    return result

# ── Shared question columns ───────────────────────────────────────────────────

QUESTION_COLUMNS = (
    "question_number", "question_text", "question_type",
    "option_a", "option_b", "option_c", "option_d",
    "correct_answer", "model_answer", "explanation",
    "topic_tag", "difficulty", "marks",
)

# ── Supabase helpers — single mode ────────────────────────────────────────────

def mark_extracting(sb: Client):
    sb.table("past_questions").update({
        "processing_status": "extracting",
        "processing_started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", RECORD_ID).execute()

def save_text(sb: Client, text: str, quality: float):
    sb.table("past_questions").update({
        "extracted_text": text,
        "extraction_quality": quality,
    }).eq("id", RECORD_ID).execute()

def mark_ready(sb: Client):
    sb.table("past_questions").update({
        "processing_status": "ready",
        "processing_error": None,
    }).eq("id", RECORD_ID).execute()

def mark_failed(sb: Client, error: str):
    sb.table("past_questions").update({
        "processing_status": "failed",
        "processing_error": error[:500],
    }).eq("id", RECORD_ID).execute()

def questions_exist(sb: Client) -> bool:
    res = (
        sb.table("questions")
        .select("id")
        .eq("past_question_id", RECORD_ID)
        .limit(1)
        .execute()
    )
    return bool(res and res.data)

def insert_questions(sb: Client, questions: list[dict]):
    """Insert questions for single (past_questions) mode."""
    rows = [
        {
            **{col: q.get(col) for col in QUESTION_COLUMNS},
            "past_question_id": RECORD_ID,
            "section_id":       None,
            "course_id":        None,   # single mode doesn't pass COURSE_ID; set via FK if needed
            "ai_processed":     True,
            "is_verified":      False,
            "edited_by_admin":  False,
        }
        for q in questions
    ]
    sb.table("questions").insert(rows).execute()

# ── Supabase helpers — section mode ──────────────────────────────────────────

def mark_section_extracting(sb: Client):
    sb.table("course_document_sections").update({
        "processing_status": "extracting",
    }).eq("id", SECTION_ID).execute()

def save_section_text(sb: Client, text: str, quality: float):
    sb.table("course_document_sections").update({
        "extracted_text": text,
        "extraction_quality": quality,
    }).eq("id", SECTION_ID).execute()

def mark_section_ready(sb: Client):
    sb.table("course_document_sections").update({
        "processing_status": "ready",
        "processing_error": None,
    }).eq("id", SECTION_ID).execute()

def mark_section_failed(sb: Client, error: str):
    sb.table("course_document_sections").update({
        "processing_status": "failed",
        "processing_error": error[:500],
    }).eq("id", SECTION_ID).execute()

def section_questions_exist(sb: Client) -> bool:
    res = (
        sb.table("questions")
        .select("id")
        .eq("section_id", SECTION_ID)
        .limit(1)
        .execute()
    )
    return bool(res and res.data)

def insert_section_questions(sb: Client, questions: list[dict]):
    """Insert questions for section (multi-course PDF) mode."""
    rows = [
        {
            **{col: q.get(col) for col in QUESTION_COLUMNS},
            "past_question_id": None,       # section questions have no past_question_id
            "section_id":       SECTION_ID,
            "course_id":        COURSE_ID,
            "ai_processed":     True,
            "is_verified":      False,
            "edited_by_admin":  False,
        }
        for q in questions
    ]
    sb.table("questions").insert(rows).execute()

# ── Mode runners ──────────────────────────────────────────────────────────────

def run_single_mode():
    sb = _supabase()
    mark_extracting(sb)
    logger.info("Processing record %s", RECORD_ID)

    try:
        file_bytes = download_from_b2(FILE_KEY)
        logger.info("Downloaded %d bytes", len(file_bytes))

        text, quality = extract_text(file_bytes, MIME_TYPE)
        save_text(sb, text, quality)
        logger.info("Extracted text, quality=%.2f, chars=%d", quality, len(text))

        if not questions_exist(sb):
            questions = process_questions(text, COURSE_NAME, INSTITUTION)
            insert_questions(sb, questions)
            logger.info("Inserted %d questions", len(questions))
        else:
            logger.info("Questions already exist, skipping")

        mark_ready(sb)
        logger.info("Done — record %s is ready", RECORD_ID)

    except Exception as e:
        logger.exception("Worker failed")
        mark_failed(sb, str(e))
        sys.exit(1)


def run_section_mode():
    sb = _supabase()
    mark_section_extracting(sb)
    logger.info("Processing section %s (pages %d–%d)", SECTION_ID, START_PAGE, END_PAGE)

    try:
        # 1. Download full PDF from B2
        file_bytes = download_from_b2(FILE_KEY)
        logger.info("Downloaded %d bytes", len(file_bytes))

        # 2. Slice to the section's page range (PDF only; images are single-page)
        if MIME_TYPE == "application/pdf" and START_PAGE > 0 and END_PAGE >= START_PAGE:
            sliced = slice_pdf(file_bytes, START_PAGE, END_PAGE)
            logger.info("Sliced PDF: %d bytes", len(sliced))
        else:
            sliced = file_bytes

        # 3. Extract text from the sliced PDF
        text, quality = extract_text(sliced, MIME_TYPE)
        save_section_text(sb, text, quality)
        logger.info("Extracted text, quality=%.2f, chars=%d", quality, len(text))

        # 4. Process and insert questions
        if not section_questions_exist(sb):
            questions = process_questions(text, COURSE_NAME, INSTITUTION)
            insert_section_questions(sb, questions)
            logger.info("Inserted %d questions for section %s", len(questions), SECTION_ID)
        else:
            logger.info("Questions already exist for section, skipping")

        # 5. Mark section ready
        mark_section_ready(sb)
        logger.info("Done — section %s is ready", SECTION_ID)

    except Exception as e:
        logger.exception("Section worker failed")
        mark_section_failed(sb, str(e))
        sys.exit(1)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    logger.info("Mode: %s", MODE)
    if MODE == "section":
        run_section_mode()
    else:
        run_single_mode()

if __name__ == "__main__":
    main()
