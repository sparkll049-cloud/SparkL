"""
app/viewer_cache.py
-------------------
Two-layer cache for the viewer pipeline.

Layer 1 — In-process LRU dict (instant, no network, lost on restart)
Layer 2 — Redis (optional; survives restarts; shared across instances)

What is cached (and what is NOT):
  ✓  Base page image bytes  — same for all users, expensive to produce
  ✓  Question metadata      — Supabase row (file_url, mime, course_id, uploader)
  ✓  Uploader display name  — profiles lookup
  ✓  Page count             — pypdf result

  ✗  Watermarked image      — NEVER cached; each user gets their own footer
  ✗  Auth / subscription    — NEVER cached; must be live for every request

TTLs
  Base page image  : 24 h  (PDFs don't change after upload)
  Question record  : 10 min (status can change: approved → rejected)
  Uploader name    : 60 min
  Page count       : 24 h
"""

from __future__ import annotations

import os
import time
import threading
from typing import Any, Optional

# ── Config ─────────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL")          # set on Render; None = memory-only mode

# Maximum items kept in the in-process LRU dict per cache namespace.
# Each base-page JPEG is ~60-120 KB at dpi=150, so 200 pages ≈ up to ~24 MB RAM.
_MEM_MAX_PAGES    = 200
_MEM_MAX_METADATA = 500

TTL_PAGE      = 86_400   # 24 h
TTL_QUESTION  =    600   # 10 min
TTL_UPLOADER  =  3_600   # 1 h
TTL_PAGECOUNT = 86_400   # 24 h

# ── In-process LRU cache ───────────────────────────────────────────────────────

class _LRUCache:
    """Thread-safe LRU dict with per-entry TTL."""

    def __init__(self, max_size: int) -> None:
        self._max  = max_size
        self._data: dict[str, tuple[Any, float]] = {}   # key → (value, expires_at)
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._data[key]
                return None
            # Move to end (most-recently used)
            self._data.pop(key)
            self._data[key] = (value, expires_at)
            return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            # Evict oldest entry if at capacity
            if key not in self._data and len(self._data) >= self._max:
                oldest = next(iter(self._data))
                del self._data[oldest]
            self._data[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    @property
    def size(self) -> int:
        return len(self._data)


# Module-level caches
_page_cache     = _LRUCache(_MEM_MAX_PAGES)
_metadata_cache = _LRUCache(_MEM_MAX_METADATA)

# ── Redis client (optional) ────────────────────────────────────────────────────

_redis: Any = None
_redis_ok   = False

def _get_redis():
    global _redis, _redis_ok
    if _redis is not None:
        return _redis if _redis_ok else None
    if not REDIS_URL:
        return None
    try:
        import redis
        _redis   = redis.from_url(REDIS_URL, decode_responses=False, socket_timeout=1)
        _redis.ping()
        _redis_ok = True
        print("[viewer_cache] Redis connected ✓")
    except Exception as e:
        print(f"[viewer_cache] Redis unavailable — memory-only mode ({e})")
        _redis_ok = False
    return _redis if _redis_ok else None


# ── Generic get/set that tries Redis first, falls back to memory ───────────────

def _cache_get(key: str, mem: _LRUCache) -> Optional[bytes | Any]:
    # 1. Memory first (fastest)
    val = mem.get(key)
    if val is not None:
        return val
    # 2. Redis
    r = _get_redis()
    if r:
        try:
            val = r.get(key)
            if val is not None:
                # Warm the memory cache so the next hit is local
                mem.set(key, val, TTL_PAGE)
                return val
        except Exception:
            pass
    return None


def _cache_set(key: str, value: Any, ttl: int, mem: _LRUCache) -> None:
    mem.set(key, value, ttl)
    r = _get_redis()
    if r:
        try:
            r.set(key, value, ex=ttl)
        except Exception:
            pass   # Redis write failure is non-fatal; memory cache still works


def _cache_delete(key: str, mem: _LRUCache) -> None:
    mem.delete(key)
    r = _get_redis()
    if r:
        try:
            r.delete(key)
        except Exception:
            pass


# ── Public API ─────────────────────────────────────────────────────────────────

# ── Base page images ───────────────────────────────────────────────────────────

def page_key(question_id: str, page_num: int) -> str:
    return f"sparkl:page:{question_id}:{page_num}"


def get_base_page(question_id: str, page_num: int) -> Optional[bytes]:
    """
    Return cached raw JPEG bytes for this page (before watermark),
    or None if not cached yet.
    """
    return _cache_get(page_key(question_id, page_num), _page_cache)


def set_base_page(question_id: str, page_num: int, jpeg_bytes: bytes) -> None:
    """Store rendered JPEG bytes (no watermark) for this page."""
    _cache_set(page_key(question_id, page_num), jpeg_bytes, TTL_PAGE, _page_cache)


def invalidate_question_pages(question_id: str) -> None:
    """
    Call this when a question is updated/deleted in the admin panel
    so stale page images are not served.
    Clears all known pages 1-500 from both caches.
    """
    for p in range(1, 501):
        _cache_delete(page_key(question_id, p), _page_cache)


# ── Question metadata ──────────────────────────────────────────────────────────

def question_meta_key(question_id: str) -> str:
    return f"sparkl:qmeta:{question_id}"


def get_question_meta(question_id: str) -> Optional[dict]:
    import pickle
    raw = _cache_get(question_meta_key(question_id), _metadata_cache)
    if raw is None:
        return None
    # Redis stores bytes; memory cache stores the dict directly
    if isinstance(raw, bytes):
        try:
            return pickle.loads(raw)
        except Exception:
            return None
    return raw


def set_question_meta(question_id: str, meta: dict) -> None:
    import pickle
    # Store as-is in memory, as pickle bytes in Redis
    _metadata_cache.set(question_meta_key(question_id), meta, TTL_QUESTION)
    r = _get_redis()
    if r:
        try:
            r.set(question_meta_key(question_id), pickle.dumps(meta), ex=TTL_QUESTION)
        except Exception:
            pass


def invalidate_question_meta(question_id: str) -> None:
    _cache_delete(question_meta_key(question_id), _metadata_cache)


# ── Uploader name ──────────────────────────────────────────────────────────────

def uploader_key(user_id: str) -> str:
    return f"sparkl:uploader:{user_id}"


def get_uploader_name(user_id: str) -> Optional[str]:
    raw = _cache_get(uploader_key(user_id), _metadata_cache)
    if raw is None:
        return None
    return raw.decode() if isinstance(raw, bytes) else raw


def set_uploader_name(user_id: str, name: str) -> None:
    _metadata_cache.set(uploader_key(user_id), name, TTL_UPLOADER)
    r = _get_redis()
    if r:
        try:
            r.set(uploader_key(user_id), name.encode(), ex=TTL_UPLOADER)
        except Exception:
            pass


# ── Page count ─────────────────────────────────────────────────────────────────

def page_count_key(question_id: str) -> str:
    return f"sparkl:pagecount:{question_id}"


def get_page_count(question_id: str) -> Optional[int]:
    raw = _cache_get(page_count_key(question_id), _metadata_cache)
    if raw is None:
        return None
    return int(raw) if isinstance(raw, (bytes, str)) else raw


def set_page_count(question_id: str, count: int) -> None:
    _metadata_cache.set(page_count_key(question_id), count, TTL_PAGECOUNT)
    r = _get_redis()
    if r:
        try:
            r.set(page_count_key(question_id), str(count).encode(), ex=TTL_PAGECOUNT)
        except Exception:
            pass


# ── Debug / health ─────────────────────────────────────────────────────────────

def cache_stats() -> dict:
    return {
        "mode":           "redis+memory" if _redis_ok else "memory-only",
        "pages_in_mem":   _page_cache.size,
        "meta_in_mem":    _metadata_cache.size,
        "redis_url_set":  bool(REDIS_URL),
        "redis_ok":       _redis_ok,
    }
