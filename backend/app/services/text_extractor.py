"""Gemini-only extraction for PDFs and images.

Replace the current text_extractor.py provider waterfall with this module.
Native PDF text extraction is attempted first because it is free and fast.
Gemini is used only when native extraction is missing or below the quality gate.
"""
from __future__ import annotations

import io
import logging
import os
import re

from google import genai
from google.genai import types
from pypdf import PdfReader

logger = logging.getLogger("text_extractor")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-3.6-flash")
MAX_GEMINI_INPUT_BYTES = int(os.getenv("MAX_GEMINI_INPUT_BYTES", str(20 * 1024 * 1024)))

_gemini_client: genai.Client | None = (
    genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
)

EXTRACTION_PROMPT = (
    "This is an academic past-examination paper. Extract all readable text. "
    "Preserve page order, question numbering, options, mathematical notation, "
    "tables, and section structure. Do not summarize, solve, or add commentary. "
    "Return only the transcription. If a region cannot be read, write "
    "[unreadable section]."
)


class UnsupportedFileTypeError(Exception):
    pass


class EmptyExtractionError(Exception):
    pass


class ExtractionResult:
    def __init__(self, text: str, method: str, quality: float):
        self.text = text
        self.method = method
        self.quality = quality

    def __repr__(self) -> str:
        return f"<ExtractionResult method={self.method!r} quality={self.quality:.2f} chars={len(self.text)}>"


def _score_text(text: str) -> float:
    if not text:
        return 0.0
    words = text.split()
    if len(words) < 10:
        return 0.1
    clean = sum(1 for word in words if any(ch.isalpha() for ch in word))
    ratio = clean / len(words)
    if ratio > 0.7:
        return 1.0
    if ratio > 0.4:
        return 0.6
    return 0.3


def _extract_pdf_native(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        return "\n\n".join(page for page in pages if page).strip()
    except Exception as exc:
        logger.warning("[pypdf] extraction failed: %s", exc)
        return ""


def _strip_thinking_tags(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _gemini_vision(file_bytes: bytes, mime_type: str) -> str:
    if not _gemini_client:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    if len(file_bytes) > MAX_GEMINI_INPUT_BYTES:
        raise RuntimeError("file is too large for the Gemini extraction limit")

    response = _gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            EXTRACTION_PROMPT,
        ],
        config=types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=12000,
        ),
    )
    return _strip_thinking_tags((response.text or "").strip())


def extract_text(filename: str, file_bytes: bytes) -> ExtractionResult:
    lower = (filename or "").lower()
    if lower.endswith(".pdf"):
        native = _extract_pdf_native(file_bytes)
        score = _score_text(native)
        if native and score >= 0.4:
            return ExtractionResult(native, "pypdf", score)
        try:
            vision = _gemini_vision(file_bytes, "application/pdf")
        except Exception as exc:
            logger.warning("[Gemini] PDF extraction failed: %s", exc)
            vision = ""
        if vision:
            return ExtractionResult(vision, "gemini", _score_text(vision))
        if native:
            return ExtractionResult(native, "pypdf-low-quality", score)
        raise EmptyExtractionError("Could not extract readable text from this PDF.")

    if lower.endswith((".jpg", ".jpeg")):
        mime_type = "image/jpeg"
    elif lower.endswith(".png"):
        mime_type = "image/png"
    else:
        raise UnsupportedFileTypeError(
            f"Unsupported file type: {filename!r}. Upload a PDF, JPG, or PNG."
        )

    try:
        text = _gemini_vision(file_bytes, mime_type)
    except Exception as exc:
        logger.warning("[Gemini] image extraction failed: %s", exc)
        text = ""
    if not text:
        raise EmptyExtractionError("Could not read text from this image.")
    return ExtractionResult(text, "gemini", _score_text(text))
