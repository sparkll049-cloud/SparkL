"""
text_quality.py
---------------
Lightweight, dependency-free heuristic for estimating how trustworthy
OCR/parsed text looks. This is NOT a real OCR confidence score (we don't
have per-word confidence available from the extraction pipeline) — it's
just a cheap way to catch obviously garbled output so admins know to
double-check before approving, and students get a heads-up.
"""

LOW_QUALITY_THRESHOLD = 0.5


def estimate_extraction_quality(text: str) -> float:
    """Returns a 0-1 score. Combines:
      - alpha_ratio: fraction of characters that are letters (garbled
        OCR tends to spit out lots of symbols/noise)
      - plausible_word_ratio: fraction of "words" that look like real
        words (mostly letters, length >= 2, contains a vowel)
    """
    if not text or not text.strip():
        return 0.0

    words = text.split()
    if not words:
        return 0.0

    alpha_chars = sum(c.isalpha() for c in text)
    alpha_ratio = alpha_chars / len(text) if text else 0.0

    def is_plausible(word: str) -> bool:
        letters = [c for c in word if c.isalpha()]
        if len(letters) < 2:
            return False
        if len(letters) / len(word) < 0.6:
            return False
        return any(c.lower() in "aeiou" for c in letters)

    plausible_ratio = sum(is_plausible(w) for w in words) / len(words)

    quality = 0.4 * alpha_ratio + 0.6 * plausible_ratio
    return round(quality, 3)