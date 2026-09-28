"""
app/services/chunker.py

Deterministic, page-aware chunking. No LLM involved.

Input text may contain form-feed characters ("\\f") between PDF pages; that is how
page numbers are recovered. Text without them gets page_number=None.
"""

from __future__ import annotations

import re

_HEADING = re.compile(
    r"^(#{1,4}\s+.+"                       # markdown heading
    r"|\d+(\.\d+)*[.)]?\s+[A-Z].{2,70}"    # 1. Introduction / 2.3 Cell structure
    r"|[A-Z][A-Z0-9 ,:&/\-]{3,70})$"       # ALL CAPS HEADING
)


def _is_heading(line: str) -> bool:
    s = line.strip()
    return 3 <= len(s) <= 80 and not s.endswith((".", ",", ";")) and bool(_HEADING.match(s))


def _split_long(text: str, max_chars: int) -> list[str]:
    """Split an oversized paragraph on sentence ends, hard-slicing as a last resort."""
    out, cur = [], ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        while len(sentence) > max_chars:
            if cur:
                out.append(cur); cur = ""
            out.append(sentence[:max_chars]); sentence = sentence[max_chars:]
        if cur and len(cur) + len(sentence) + 1 > max_chars:
            out.append(cur); cur = sentence
        else:
            cur = f"{cur} {sentence}".strip()
    if cur:
        out.append(cur)
    return out


def chunk_text(text: str, target: int = 1000, max_chars: int = 1400, max_chunks: int = 400) -> list[dict]:
    pages = text.split("\f")
    paged = len(pages) > 1

    chunks: list[dict] = []
    buf: list[str] = []
    state = {"len": 0, "page": None, "heading": None}
    heading: str | None = None

    def flush() -> None:
        body = "\n\n".join(buf).strip()
        if body:
            chunks.append({
                "chunk_index": len(chunks),
                "page_number": state["page"],
                "section_title": state["heading"],
                "content": body,
            })
        buf.clear()
        state.update(len=0, page=None, heading=None)

    def add(paragraph: str, page_no: int | None) -> None:
        paragraph = paragraph.strip()
        if not paragraph:
            return
        for piece in _split_long(paragraph, max_chars):
            if buf and state["len"] + len(piece) > target:
                flush()
            if not buf:
                state["page"], state["heading"] = page_no, heading
            buf.append(piece)
            state["len"] += len(piece)

    for page_index, page in enumerate(pages, start=1):
        page_no = page_index if paged else None
        para: list[str] = []

        def end_para() -> None:
            if para:
                add(" ".join(para), page_no)
                para.clear()

        for raw in page.split("\n"):
            line = raw.strip()
            if not line:
                end_para()
            elif _is_heading(line):
                end_para()
                if buf and state["len"] >= target * 0.4:
                    flush()          # start a new chunk under the new heading
                heading = line.lstrip("# ").strip()
            else:
                para.append(line)
        end_para()
        if paged:
            flush()                  # keep chunks inside one page so citations stay accurate

        if len(chunks) >= max_chunks:
            break

    flush()
    return chunks[:max_chunks]
