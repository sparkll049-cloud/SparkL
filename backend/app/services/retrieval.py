"""
app/services/retrieval.py

Notes retrieval for SparkL Cram.
  - stores chunks in cram_chunks (see migrations/002_cram_chunks.sql)
  - keyword search through Postgres full-text search (free, no embeddings)
  - evidence gate: chunks must cover enough of the question's keywords
  - even-spread sampling for summaries and quizzes
  - app-generated source citations (the model never writes them)
"""

from __future__ import annotations

import asyncio
import math
import re
from functools import partial

from app.services.chunker import chunk_text
from app.services.tutor_policy import RETRIEVAL
from app.supabase_client import supabase

STOPWORDS = set("""
a about above after again all also am an and any are as at be because been before being below between both but by
can could did do does doing down during each few for from further had has have having he her here hers him his how
i if in into is it its just me more most my no nor not of off on once only or other our out over own same she should
so some such than that the their them then there these they this those through to too under until up very was we
were what when where which while who whom why will with would you your explain tell describe define give please
notes note question answer means meaning mean
""".split())


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def extract_keywords(text: str, cap: int = 12) -> list[str]:
    seen: list[str] = []
    for t in tokenize(text):
        if len(t) >= 3 and t not in STOPWORDS and t not in seen:
            seen.append(t)
    return seen[:cap]


def stem(word: str) -> str:
    for suf in ("ations", "ation", "ings", "ing", "ies", "es", "ed", "ly", "s"):
        if word.endswith(suf) and len(word) - len(suf) >= 3:
            return word[: -len(suf)]
    return word


# ── sync DB helpers ────────────────────────────────────────────────────────────

def _sync_count(session_id: str) -> int:
    res = supabase.table("cram_chunks").select("id", count="exact").eq("session_id", session_id).execute()
    return res.count or 0


def _sync_store(session_id: str, user_id: str, chunks: list[dict]) -> None:
    rows = [{**c, "session_id": session_id, "user_id": user_id} for c in chunks]
    for i in range(0, len(rows), 100):
        supabase.table("cram_chunks").upsert(
            rows[i : i + 100], on_conflict="session_id,chunk_index", ignore_duplicates=True
        ).execute()


def _sync_search(session_id: str, query: str, limit: int) -> list[dict]:
    res = supabase.rpc(
        "search_cram_chunks", {"p_session_id": session_id, "p_query": query, "p_limit": limit}
    ).execute()
    return res.data or []


def _sync_sample(session_id: str, n: int) -> list[dict]:
    idx_res = (
        supabase.table("cram_chunks").select("chunk_index")
        .eq("session_id", session_id).order("chunk_index").execute()
    )
    indexes = [r["chunk_index"] for r in (idx_res.data or [])]
    if not indexes:
        return []
    if len(indexes) > n:
        step = len(indexes) / n
        indexes = [indexes[int(i * step)] for i in range(n)]
    res = (
        supabase.table("cram_chunks")
        .select("chunk_index, page_number, section_title, content")
        .eq("session_id", session_id).in_("chunk_index", indexes).order("chunk_index").execute()
    )
    return res.data or []


async def _run(fn, *args):
    return await asyncio.get_running_loop().run_in_executor(None, partial(fn, *args))


# ── public API ─────────────────────────────────────────────────────────────────

async def ensure_chunked(session_id: str, user_id: str, text: str) -> bool:
    """Chunk the session's notes once. Also upgrades sessions created before chunking existed."""
    try:
        if await _run(_sync_count, session_id) > 0:
            return True
        chunks = chunk_text(
            text,
            target=RETRIEVAL["chunk_target_chars"],
            max_chars=RETRIEVAL["chunk_max_chars"],
            max_chunks=RETRIEVAL["max_chunks_per_session"],
        )
        if not chunks:
            return False
        await _run(_sync_store, session_id, user_id, chunks)
        return True
    except Exception as e:
        print(f"[chunking failed] {e}")
        return False


async def retrieve_chunks(session_id: str, question: str, previous_question: str = "") -> list[dict]:
    """Return the best chunks, or [] when the notes do not cover the question."""
    keywords = extract_keywords(question)
    if len(keywords) < 2 and previous_question:            # follow-ups like "explain that more"
        keywords = list(dict.fromkeys(keywords + extract_keywords(previous_question)))[:12]
    if not keywords:
        return []

    rows = await _run(_sync_search, session_id, " | ".join(keywords), RETRIEVAL["max_candidates"])
    if not rows:
        return []

    kw_stems = [stem(k) for k in keywords]
    needed = max(1, math.ceil(RETRIEVAL["min_keyword_coverage"] * len(keywords)))

    scored = []
    for r in rows:
        toks = {stem(t) for t in tokenize(f"{r.get('section_title') or ''} {r['content']}")}
        hits = sum(1 for k in kw_stems if k in toks)
        if hits >= needed:
            scored.append((hits, r.get("rank") or 0, r))
    if not scored:
        return []

    scored.sort(key=lambda s: (s[0], s[1]), reverse=True)
    chosen, total = [], 0
    for _, _, r in scored[: RETRIEVAL["max_retrieved_chunks"]]:
        if chosen and total + len(r["content"]) > RETRIEVAL["max_retrieved_chars"]:
            break
        chosen.append(r)
        total += len(r["content"])
    return sorted(chosen, key=lambda r: r["chunk_index"])


async def sample_chunks(session_id: str, n: int) -> list[dict]:
    return await _run(_sync_sample, session_id, n)


def chunk_context(title: str, chunks: list[dict]) -> str:
    parts = [f"=== Study Notes: {title} (excerpts) ==="]
    for i, c in enumerate(chunks, start=1):
        label = f"[Excerpt {i}"
        if c.get("page_number"):
            label += f", p.{c['page_number']}"
        if c.get("section_title"):
            label += f", {c['section_title']}"
        parts.append(f"{label}]\n{c['content']}")
    parts.append("=== End ===")
    return "\n\n".join(parts)


def format_sources(chunks: list[dict]) -> str:
    """Citation line added by the app, never by the model."""
    pages = sorted({c["page_number"] for c in chunks if c.get("page_number")})
    if pages:
        label = "p. " if len(pages) == 1 else "pp. "
        return f"\n\n*Sources: {label}{', '.join(str(p) for p in pages)}*"
    titles = list(dict.fromkeys(c["section_title"] for c in chunks if c.get("section_title")))[:3]
    if titles:
        return "\n\n*Sources: " + "; ".join(titles) + "*"
    return ""
