"""
text_extractor.py
------------------
Extracts raw text from an uploaded past-question file (PDF, JPG, PNG).

- PDFs with a real text layer (digitally generated): extracted directly
  via pypdf. Fast, free, no API call needed.
- Images, and scanned PDFs with no usable text layer: sent directly to
  Gemini's vision model, which reads the document and returns clean
  transcribed text in one call — no separate OCR engine or local
  system binaries (tesseract/poppler) required.
"""

from __future__ import annotations

import io
import os

from pypdf import PdfReader
from google import genai
from google.genai import types

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_AVAILABLE = bool(GEMINI_API_KEY)

_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_AVAILABLE else None

# Check ai.google.dev for the current recommended free-tier model name —
# Google renames/rotates these periodically.
GEMINI_MODEL = "gemini-2.5-flash"

EXTRACTION_PROMPT = (
    "This is a scanned exam/past-question paper. Transcribe all the text "
    "in this document exactly as it appears, preserving question "
    "numbering, structure, and formatting as closely as possible. Do not "
    "summarize, explain, or add any commentary. If parts are illegible, "
    "leave them out rather than guessing. Return only the transcribed "
    "text, nothing else."
)


class UnsupportedFileTypeError(Exception):
    """Raised when the file extension/content isn't one we know how to read."""


class EmptyExtractionError(Exception):
    """Raised when extraction produced no usable text at all."""


class ExtractionResult:
    def __init__(self, text: str):
        self.text = text


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for page in reader.pages:
        pages_text.append(page.extract_text() or "")
    return "\n".join(pages_text).strip()


def _extract_with_gemini(file_bytes: bytes, mime_type: str) -> str:
    """Sends the file directly to Gemini for transcription. Returns empty
    string on any failure — never let this crash the upload."""
    if not GEMINI_AVAILABLE:
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
        # Covers rate limits, network errors, bad responses — never let
        # extraction failures crash the upload request.
        return ""


def extract_text(filename: str, file_bytes: bytes) -> ExtractionResult:
    lower_name = (filename or "").lower()

    if lower_name.endswith(".pdf"):
        text = _extract_pdf_text(file_bytes)
        if not text:
            # No embedded text layer — likely a scanned PDF. Send it to
            # Gemini directly; it can read PDFs natively.
            text = _extract_with_gemini(file_bytes, "application/pdf")
    elif lower_name.endswith((".jpg", ".jpeg")):
        text = _extract_with_gemini(file_bytes, "image/jpeg")
    elif lower_name.endswith(".png"):
        text = _extract_with_gemini(file_bytes, "image/png")
    else:
        raise UnsupportedFileTypeError(
            f"Cannot extract text from file type: {filename}"
        )

    if not text:
        raise EmptyExtractionError(
            "Could not extract any text from this file. It may be a "
            "low-quality scan or an image-only document."
        )

    return ExtractionResult(text=text)