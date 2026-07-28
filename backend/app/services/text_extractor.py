"""
text_extractor.py
------------------
Extracts raw text from an uploaded past-question file (PDF, JPG, PNG).

- PDFs: text layer extracted directly via pypdf (fast, works for
  digitally-generated PDFs).
- Images (and PDFs with no usable text layer, i.e. scanned documents):
  OCR via pytesseract, if installed, after a Pillow-only preprocessing
  pass (grayscale, upscale, contrast, sharpen, binarize) to improve
  accuracy on phone-camera scans. If OCR libraries OR the underlying
  Tesseract/Poppler binaries aren't available in this environment, we
  degrade gracefully rather than crashing the server — the upload still
  gets stored, just with lower-confidence extracted text for admin review.
"""

from __future__ import annotations

import io

from pypdf import PdfReader

try:
    import pytesseract
    from PIL import Image, ImageOps, ImageFilter

    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

# OEM 1 = LSTM engine (better accuracy than legacy), PSM 6 = assume a
# single uniform block of text — matches scanned exam pages better than
# Tesseract's default "sparse text" mode.
TESSERACT_CONFIG = "--oem 1 --psm 6"

# If the shorter image side is below this, upscale before OCR — small
# phone-camera scans lose a lot of accuracy at native resolution.
MIN_DIMENSION = 1800


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


def _preprocess_for_ocr(image: "Image.Image") -> "Image.Image":
    """Pillow-only preprocessing pipeline to improve OCR accuracy on
    photographed/scanned pages, without requiring OpenCV."""

    width, height = image.size
    shorter_side = min(width, height)
    if shorter_side < MIN_DIMENSION:
        scale = MIN_DIMENSION / shorter_side
        image = image.resize(
            (int(width * scale), int(height * scale)),
            Image.LANCZOS,
        )

    image = image.convert("L")
    image = ImageOps.autocontrast(image, cutoff=1)
    image = image.filter(ImageFilter.SHARPEN)

    # Simple global threshold — cruder than adaptive thresholding (which
    # needs OpenCV), but still helps on reasonably evenly-lit scans.
    threshold = 160
    image = image.point(lambda p: 255 if p > threshold else 0)

    return image


def _ocr_image_bytes(file_bytes: bytes) -> str:
    if not OCR_AVAILABLE:
        return ""
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image = _preprocess_for_ocr(image)
        return pytesseract.image_to_string(image, config=TESSERACT_CONFIG).strip()
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

        # Higher DPI than the pdf2image default (72) gives Tesseract a
        # sharper source image to work with.
        images = convert_from_bytes(file_bytes, dpi=300)
        texts = []
        for img in images:
            processed = _preprocess_for_ocr(img)
            texts.append(pytesseract.image_to_string(processed, config=TESSERACT_CONFIG))
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
