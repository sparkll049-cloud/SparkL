"""
text_extractor.py
------------------
Extracts raw text from an uploaded past-question file (PDF, JPG, PNG).

- PDFs with a real text layer: extracted directly via pypdf.
- Scanned PDFs / images: sent to Gemini vision model.
- Blur, low quality, image-PDFs: Gemini handles all of these.
- If extraction fails completely: raises ExtractionFailedError so the
  upload endpoint can reject the file before it reaches admin queue.
"""

from __future__ import annotations

import io
import os

from pypdf import PdfReader
from google import genai
from google.genai import types

GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY")
GEMINI_AVAILABLE = bool(GEMINI_API_KEY)

_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_AVAILABLE else None

GEMINI_MODEL = "gemini-3.6-flash"

# Aggressive prompt — tells Gemini to try its hardest even on bad scans
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


class UnsupportedFileTypeError(Exception):
    pass


class EmptyExtractionError(Exception):
    pass


class ExtractionResult:
    def __init__(self, text: str, method: str, quality: float):
        self.text    = text
        self.method  = method   # "pypdf" | "gemini" | "gemini-fallback"
        self.quality = quality  # 0.0 – 1.0


def _score_text(text: str) -> float:
    """
    Rough quality score based on text length and readability.
    0.0 = useless, 1.0 = clean digital text.
    """
    if not text:
        return 0.0
    words = text.split()
    if len(words) < 10:
        return 0.1
    # Check ratio of real words vs garbled characters
    clean = sum(1 for w in words if w.isalpha() and len(w) > 1)
    ratio = clean / len(words)
    if ratio > 0.7:
        return 1.0
    if ratio > 0.4:
        return 0.6
    return 0.3


def _extract_pdf_native(file_bytes: bytes) -> str:
    """Extract text from PDF text layer via pypdf."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages  = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    except Exception:
        return ""


def _extract_with_gemini(file_bytes: bytes, mime_type: str) -> str:
    """
    Send file to Gemini vision for transcription.
    Works on: images, scanned PDFs, blurry docs, image-only PDFs.
    Returns empty string on any failure — never crashes.
    """
    if not GEMINI_AVAILABLE or not _client:
        return ""
    try:
        response = _client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                EXTRACTION_PROMPT,
            ],
        )
        return (response.text or "").strip()
    except Exception:
        return ""


def extract_text(filename: str, file_bytes: bytes) -> ExtractionResult:
    """
    Main extraction entry point. Strategy:

    PDF:
      1. Try pypdf (fast, free, works on digital PDFs)
      2. If result is empty or low quality → fallback to Gemini vision
         (handles scanned PDFs, image-PDFs, blurry scans)

    JPG / PNG:
      1. Gemini vision directly (no native text layer possible)

    Raises EmptyExtractionError if ALL methods return nothing — this
    means the file is completely unreadable and should be rejected before
    reaching the admin queue.
    """
    lower = (filename or "").lower()

    if lower.endswith(".pdf"):
        # Step 1: native text layer
        native = _extract_pdf_native(file_bytes)
        score  = _score_text(native)

        if native and score >= 0.4:
            return ExtractionResult(text=native, method="pypdf", quality=score)

        # Step 2: fallback — Gemini handles scanned / image PDFs
        gemini_text = _extract_with_gemini(file_bytes, "application/pdf")
        gemini_score = _score_text(gemini_text)

        if gemini_text:
            return ExtractionResult(
                text=gemini_text,
                method="gemini-fallback",
                quality=gemini_score,
            )

        # Step 3: if Gemini also failed, return whatever pypdf got
        # (even if low quality) rather than nothing
        if native:
            return ExtractionResult(text=native, method="pypdf", quality=score)

        raise EmptyExtractionError(
            "Could not extract text from this PDF. It may be completely "
            "image-based with no readable content. Please upload a "
            "clearer scan or a text-based PDF."
        )

    elif lower.endswith((".jpg", ".jpeg")):
        text  = _extract_with_gemini(file_bytes, "image/jpeg")
        score = _score_text(text)
        if text:
            return ExtractionResult(text=text, method="gemini", quality=score)
        raise EmptyExtractionError(
            "Could not read text from this image. Please upload a "
            "clearer photo where the text is visible."
        )

    elif lower.endswith(".png"):
        text  = _extract_with_gemini(file_bytes, "image/png")
        score = _score_text(text)
        if text:
            return ExtractionResult(text=text, method="gemini", quality=score)
        raise EmptyExtractionError(
            "Could not read text from this image. Please upload a "
            "clearer photo where the text is visible."
        )

    else:
        raise UnsupportedFileTypeError(
            f"Unsupported file type: {filename}. "
            "Please upload a PDF, JPG, or PNG."
        )