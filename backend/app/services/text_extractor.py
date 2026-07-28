"""
text_extractor.py
------------------
Extracts raw text from an uploaded past-question file (PDF, JPG, PNG).

- PDFs: text layer extracted directly via pypdf (fast, works for
  digitally-generated PDFs).
- Images (and PDFs with no usable text layer, i.e. scanned documents):
  OCR via pytesseract, if installed. If OCR libraries OR the underlying
  Tesseract/Poppler binaries aren't available in this environment, we
  degrade gracefully rather than crashing the server — the upload still
  gets stored, just with lower-confidence extracted text for admin review.
"""

from __future__ import annotations

import io

from pypdf import PdfReader

try:
    import pytesseract
    from PIL import Image

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


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


def _ocr_image_bytes(file_bytes: bytes) -> str:
    if not OCR_AVAILABLE:
        return ""
    try:
        image = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(image).strip()
    except Exception:
        # Covers TesseractNotFoundError (binary missing on this host) and
        # any other OCR failure — never let this crash the upload request.
        return ""


def _ocr_pdf_pages(file_bytes: bytes) -> str:
    """OCR fallback for scanned PDFs with no text layer. Requires
    pdf2image (+ poppler) in addition to pytesseract — if either the
    Python package or the underlying binary is unavailable, returns
    empty string rather than raising."""
    if not OCR_AVAILABLE:
        return ""
    try:
        from pdf2image import convert_from_bytes

        images = convert_from_bytes(file_bytes)
        texts = [pytesseract.image_to_string(img) for img in images]
        return "\n".join(texts).strip()
    except Exception:
        # Covers ImportError, PDFInfoNotInstalledError (poppler missing),
        # TesseractNotFoundError, and any other OCR failure.
        return ""


def extract_text(filename: str, file_bytes: bytes) -> ExtractionResult:
    lower_name = (filename or "").lower()

    if lower_name.endswith(".pdf"):
        text = _extract_pdf_text(file_bytes)
        if not text:
            # Likely a scanned PDF with no embedded text layer — try OCR.
            text = _ocr_pdf_pages(file_bytes)
    elif lower_name.endswith((".jpg", ".jpeg", ".png")):
        text = _ocr_image_bytes(file_bytes)
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
