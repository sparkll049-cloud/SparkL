
"""
text_extractor.py
------------------
Extracts raw text from an uploaded past-question file (PDF, JPG, PNG).

Provider waterfall for vision extraction (tries in order):
  1. Gemini 2.5 Flash  — primary vision model
  2. Groq qwen3-32b    — vision fallback
  3. Groq gpt-oss-120b — reasoning fallback (strongest backup)

Strategies per file type:
  PDF:  pypdf native text layer first → vision fallback if low quality
  JPG / PNG: vision directly (no native text layer possible)

If ALL methods return nothing, raises EmptyExtractionError so the upload
endpoint can reject the file before it reaches the admin queue.
"""

from __future__ import annotations

import io
import logging
import os

from pypdf import PdfReader
from google import genai
from google.genai import types
from groq import Groq

logger = logging.getLogger("text_extractor")

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

GEMINI_MODEL      = "gemini-3.5-flash"
GROQ_VISION_MODEL = "qwen/qwen3-32b"
GROQ_REASON_MODEL = "openai/gpt-oss-120b"

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = (
    "This is a past exam question paper. Your job is to extract ALL text "
    "from this document, even if it is blurry, low quality, skewed, or "
    "partially damaged. Use your best judgment to read unclear text — "
    "make your best attempt at every word rather than skipping anything. "
    "Preserve question numbering, structure, and formatting as closely as "
    "possible. Do not summarize or add commentary. Return only the "
    "transcribed text, nothing else. If a section is completely "
    "unreadable, write [unreadable section] as a placeholder."
)

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class UnsupportedFileTypeError(Exception):
    pass


class EmptyExtractionError(Exception):
    pass


# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

class ExtractionResult:
    def __init__(self, text: str, method: str, quality: float):
        self.text    = text
        self.method  = method   # "pypdf" | "gemini" | "groq-vision" | "groq-reason" | "*-fallback"
        self.quality = quality  # 0.0 – 1.0

    def __repr__(self) -> str:
        return f"<ExtractionResult method={self.method!r} quality={self.quality:.2f} chars={len(self.text)}>"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _score_text(text: str) -> float:
    """
    Rough quality score: 0.0 = useless, 1.0 = clean digital text.
    Based on word count and ratio of real alphabetic words.
    """
    if not text:
        return 0.0
    words = text.split()
    if len(words) < 10:
        return 0.1
    clean = sum(1 for w in words if w.isalpha() and len(w) > 1)
    ratio = clean / len(words)
    if ratio > 0.7:
        return 1.0
    if ratio > 0.4:
        return 0.6
    return 0.3


def _extract_pdf_native(file_bytes: bytes) -> str:
    """Extract text from a PDF text layer via pypdf. Returns '' on failure."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages  = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    except Exception as e:
        logger.warning("[pypdf] Extraction failed: %s", e)
        return ""


def _strip_thinking_tags(text: str) -> str:
    """Remove <think>...</think> reasoning blocks some models emit."""
    import re
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


# ---------------------------------------------------------------------------
# Provider call functions
# ---------------------------------------------------------------------------

def _gemini_vision(file_bytes: bytes, mime_type: str) -> str:
    """Send file to Gemini vision for transcription. Returns '' on any failure."""
    if not _gemini_client:
        logger.warning("[Gemini] Client not initialised — GEMINI_API_KEY missing.")
        return ""
    try:
        logger.info("[Gemini] Sending %s (%d bytes) for vision extraction.", mime_type, len(file_bytes))
        response = _gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                EXTRACTION_PROMPT,
            ],
        )
        return (response.text or "").strip()
    except Exception as e:
        logger.warning("[Gemini] Vision extraction failed: %s", e)
        return ""


def _groq_vision(file_bytes: bytes, mime_type: str) -> str:
    """
    Send file to Groq qwen3-32b for vision transcription.
    Groq vision accepts base64-encoded images in the message content.
    Returns '' on any failure.
    """
    if not _groq_client:
        logger.warning("[Groq-Vision] Client not initialised — GROQ_API_KEY missing.")
        return ""

    # Groq vision only supports images, not raw PDF bytes
    if mime_type == "application/pdf":
        logger.info("[Groq-Vision] PDF not supported directly — skipping.")
        return ""

    import base64
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64}"

    try:
        logger.info("[Groq-Vision] Sending %s (%d bytes) for vision extraction.", mime_type, len(file_bytes))
        completion = _groq_client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": EXTRACTION_PROMPT},
                    ],
                }
            ],
            temperature=0.6,
            max_completion_tokens=8192,
            top_p=0.95,
            stream=True,
            stop=None,
        )
        chunks = []
        for chunk in completion:
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)
        raw = "".join(chunks)
        return _strip_thinking_tags(raw).strip()
    except Exception as e:
        logger.warning("[Groq-Vision] Extraction failed: %s", e)
        return ""


def _groq_reason(file_bytes: bytes, mime_type: str) -> str:
    """
    Send file to Groq gpt-oss-120b (reasoning model) for transcription.
    For PDFs, sends as text prompt with extracted bytes description.
    For images, uses base64 data URL.
    Returns '' on any failure.
    """
    if not _groq_client:
        logger.warning("[Groq-Reason] Client not initialised — GROQ_API_KEY missing.")
        return ""

    import base64
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64}"

    # Build message content depending on file type
    if mime_type == "application/pdf":
        # Reasoning model fallback for PDF: send as document if supported,
        # otherwise prompt it to do its best from a described context
        content: list = [
            {
                "type": "text",
                "text": (
                    "The following is a base64-encoded PDF of a past exam paper. "
                    "Decode and extract all text from it.\n\n"
                    + EXTRACTION_PROMPT
                    + f"\n\nBase64 PDF:\n{b64}"
                ),
            }
        ]
    else:
        content = [
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": EXTRACTION_PROMPT},
        ]

    try:
        logger.info("[Groq-Reason] Sending %s (%d bytes) for extraction.", mime_type, len(file_bytes))
        completion = _groq_client.chat.completions.create(
            model=GROQ_REASON_MODEL,
            messages=[{"role": "user", "content": content}],
            temperature=1,
            max_completion_tokens=8192,
            top_p=1,
            reasoning_effort="medium",
            stream=True,
            stop=None,
        )
        chunks = []
        for chunk in completion:
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)
        raw = "".join(chunks)
        return _strip_thinking_tags(raw).strip()
    except Exception as e:
        logger.warning("[Groq-Reason] Extraction failed: %s", e)
        return ""


# ---------------------------------------------------------------------------
# Vision waterfall
# ---------------------------------------------------------------------------

def _vision_extract(file_bytes: bytes, mime_type: str, label_suffix: str = "") -> tuple[str, str]:
    """
    Try vision providers in order. Returns (text, method_name).
    Returns ('', '') if all fail.
    """
    suffix = f"-{label_suffix}" if label_suffix else ""

    providers = [
        (f"gemini{suffix}",      lambda: _gemini_vision(file_bytes, mime_type)),
        (f"groq-vision{suffix}", lambda: _groq_vision(file_bytes, mime_type)),
        (f"groq-reason{suffix}", lambda: _groq_reason(file_bytes, mime_type)),
    ]

    for method, call in providers:
        text = call()
        if text:
            logger.info("[%s] Extraction succeeded (%d chars).", method, len(text))
            return text, method
        logger.warning("[%s] Returned empty — trying next provider.", method)

    return "", ""


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def extract_text(filename: str, file_bytes: bytes) -> ExtractionResult:
    """
    Main extraction entry point.

    PDF strategy:
      1. pypdf native text layer (fast, free, works on digital PDFs)
      2. If empty or low quality → vision waterfall (Gemini → Groq Vision → Groq Reason)
      3. If vision also fails → return whatever pypdf got, even if low quality
      4. If truly nothing → raise EmptyExtractionError

    Image strategy (JPG / PNG):
      1. Vision waterfall directly (Gemini → Groq Vision → Groq Reason)
      2. If all fail → raise EmptyExtractionError

    Raises:
        UnsupportedFileTypeError: File extension not supported.
        EmptyExtractionError: All methods returned nothing usable.
    """
    lower = (filename or "").lower()

    if lower.endswith(".pdf"):
        # Step 1: native text layer
        native = _extract_pdf_native(file_bytes)
        score  = _score_text(native)

        if native and score >= 0.4:
            logger.info("[pypdf] Good quality text extracted (score=%.2f).", score)
            return ExtractionResult(text=native, method="pypdf", quality=score)

        if native:
            logger.info("[pypdf] Low quality text (score=%.2f) — trying vision fallback.", score)
        else:
            logger.info("[pypdf] No text found — trying vision fallback.")

        # Step 2: vision waterfall
        text, method = _vision_extract(file_bytes, "application/pdf", label_suffix="fallback")
        if text:
            return ExtractionResult(text=text, method=method, quality=_score_text(text))

        # Step 3: return low-quality pypdf text rather than nothing
        if native:
            logger.warning("Vision failed — returning low-quality pypdf text as last resort.")
            return ExtractionResult(text=native, method="pypdf", quality=score)

        raise EmptyExtractionError(
            "Could not extract text from this PDF. It may be completely "
            "image-based with no readable content. Please upload a "
            "clearer scan or a text-based PDF."
        )

    elif lower.endswith((".jpg", ".jpeg")):
        text, method = _vision_extract(file_bytes, "image/jpeg")
        if text:
            return ExtractionResult(text=text, method=method, quality=_score_text(text))
        raise EmptyExtractionError(
            "Could not read text from this image. Please upload a "
            "clearer photo where the text is visible."
        )

    elif lower.endswith(".png"):
        text, method = _vision_extract(file_bytes, "image/png")
        if text:
            return ExtractionResult(text=text, method=method, quality=_score_text(text))
        raise EmptyExtractionError(
            "Could not read text from this image. Please upload a "
            "clearer photo where the text is visible."
        )

    else:
        raise UnsupportedFileTypeError(
            f"Unsupported file type: {filename!r}. "
            "Please upload a PDF, JPG, or PNG."
        )