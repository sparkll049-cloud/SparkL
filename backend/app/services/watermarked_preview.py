"""Create a watermarked derivative for admin verification.

The original B2 object remains private and is never returned to students.
The admin endpoint should sign/stream the derivative produced by this module.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas


def _label(admin_id: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"SPARKL • ADMIN REVIEW • {admin_id} • {stamp}"


def _pdf_overlay(width: float, height: float, text: str) -> bytes:
    out = io.BytesIO()
    c = canvas.Canvas(out, pagesize=(width, height))
    c.saveState()
    c.setFillColor(Color(0.12, 0.18, 0.35, alpha=0.18))
    c.setFont("Helvetica-Bold", max(12, min(width, height) / 42))
    c.translate(width / 2, height / 2)
    c.rotate(32)
    for y in range(-int(height), int(height) + 1, 90):
        for x in range(-int(width * 1.5), int(width * 1.5) + 1, 260):
            c.drawCentredString(x, y, text)
    c.restoreState()
    c.save()
    return out.getvalue()


def watermark_pdf(pdf_bytes: bytes, admin_id: str) -> bytes:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    text = _label(admin_id)
    for page in reader.pages:
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        overlay = PdfReader(io.BytesIO(_pdf_overlay(width, height, text))).pages[0]
        page.merge_page(overlay)
        writer.add_page(page)
    result = io.BytesIO()
    writer.write(result)
    return result.getvalue()


def watermark_image(image_bytes: bytes, admin_id: str) -> bytes:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    text = _label(admin_id)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", max(18, image.width // 45))
    except OSError:
        font = ImageFont.load_default()
    for y in range(-image.height, image.height * 2, max(100, image.height // 7)):
        for x in range(-image.width, image.width * 2, max(280, image.width // 4)):
            draw.text((x, y), text, fill=(30, 45, 90, 55), font=font)
    result = io.BytesIO()
    Image.alpha_composite(image, overlay).convert("RGB").save(result, format="WEBP", quality=88)
    return result.getvalue()


def watermark_preview(file_bytes: bytes, mime_type: str, admin_id: str) -> tuple[bytes, str]:
    if mime_type == "application/pdf":
        return watermark_pdf(file_bytes, admin_id), "application/pdf"
    if mime_type in {"image/jpeg", "image/png"}:
        return watermark_image(file_bytes, admin_id), "image/webp"
    raise ValueError(f"Unsupported preview type: {mime_type}")