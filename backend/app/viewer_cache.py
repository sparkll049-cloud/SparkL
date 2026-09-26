"""
app/viewer_cache.py
-------------------
Redis-first cache for the SparkL viewer pipeline.

Redis is the PRIMARY store — not optional, not a fallback.
A small in-process dict acts only as a LOCAL HOT CACHE for the
current request burst (same process, zero network), backed by Redis
for persistence and cross-instance sharing on Render.

Setup on Render
---------------
1. Create a Redis instance in your Render dashboard
   (free tier: 25 MB — more than enough for metadata)
2. Copy the "Internal Redis URL" and set it as an env var:
     REDIS_URL=redis://red-xxxxx:6379
3. Add to requirements.txt:
     redis>=5.0.0

What is cached
--------------
  ✓  Base page JPEG   — rendered page before watermark; 24 h TTL
                        same bytes for ALL users → huge win
  ✓  Question meta    — Supabase row; 10 min TTL (status can flip)
  ✓  Uploader name    — profiles row; 1 h TTL
  ✓  Page count       — pypdf result; 24 h TTL

  ✗  Watermarked image — NEVER cached; per-user footer differs
  ✗  Auth token        — NEVER cached; must be live every request
  ✗  Subscription      — NEVER cached; cancellation must take effect now
  ✗  Course access     — NEVER cached; enrolment can change

Cache invalidation
------------------
Call from your admin router when a question is updated/re-uploaded/deleted:

    from app.viewer_cache import invalidate_question

    invalidate_question(question_id)   # clears pages + meta + page-count

TTLs
----
  Base page image : 86400 s  (24 h)
  Question record :   600 s  (10 min)
  Uploader name   :  3600 s  (1 h)
  Page count      : 86400 s  (24 h)
"""

from __future__ import annotations

import os
import pickle
import time
import threading
from typing import Any, Optional

import redis as _redis_lib

# ── Config ─────────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL")

TTL_PAGE      = 86_400   # 24 h
TTL_QUESTION  =    600   # 10 min
TTL_UPLOADER  =  3_600   # 1 h
TTL_PAGECOUNT = 86_400   # 24 h

# Local hot cache: keeps the last N items in this process so requests
# that hit the same page in rapid succession skip the Redis round-trip.
_HOT_MAX   = 64
_HOT_TTL   = 30          # seconds — just long enough to absorb a burst

# ── Redis client ────────────────────────────────────────────────────────────────

_r: Optional[_redis_lib.Redis] = None
_r_lock = threading.Lock()


def _redis() -> _redis_lib.Redis:
    """
    Return the shared Redis client, connecting on first call.
    Raises RuntimeError if REDIS_URL is not set — fail loud so you
    notice in development rather than silently missing cache.
    """
    global _r
    if _r is not None:
        return _r
    with _r_lock:
        if _r is not None:
            return _r
        if not REDIS_URL:
            raise RuntimeError(
                "[viewer_cache] REDIS_URL is not set. "
                "Add it in your Render environment variables."
            )
        client = _redis_lib.from_url(
            REDIS_URL,
            decode_responses=False,   # we store raw bytes (JPEG, pickle)
            socket_timeout=2,
            socket_connect_timeout=2,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        client.ping()   # fail fast if misconfigured
        _r = client
        print("[viewer_cache] Redis connected ✓")
        return _r


def redis_ok() -> bool:
    try:
        _redis().ping()
        return True
    except Exception:
        return False


# ── In-process hot cache (LRU, per-process only) ───────────────────────────────

class _HotCache:
    """
    Tiny thread-safe LRU dict.
    Purpose: absorb same-page bursts within one Render instance so we
    don't make a Redis round-trip for every concurrent request.
    NOT a substitute for Redis — Redis is the source of truth.
    """
    def __init__(self, max_size: int) -> None:
        self._max  = max_size
        self._data: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._data.get(key)
            if not entry:
                return None
            val, exp = entry
            if time.monotonic() > exp:
                del self._data[key]
                return None
            self._data.pop(key)
            self._data[key] = (val, exp)
            return val

    def set(self, key: str, val: Any, ttl: int = _HOT_TTL) -> None:
        with self._lock:
            if key not in self._data and len(self._data) >= self._max:
                del self._data[next(iter(self._data))]
            self._data[key] = (val, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    @property
    def size(self) -> int:
        return len(self._data)


_hot = _HotCache(_HOT_MAX)


# ── Low-level get/set/delete ───────────────────────────────────────────────────

def _get(key: str) -> Optional[bytes]:
    # 1. Hot cache (zero latency)
    val = _hot.get(key)
    if val is not None:
        return val
    # 2. Redis (primary store)
    val = _redis().get(key)
    if val is not None:
        _hot.set(key, val)
    return val


def _set(key: str, value: bytes, ttl: int) -> None:
    _redis().set(key, value, ex=ttl)
    _hot.set(key, value, min(ttl, _HOT_TTL))


def _delete(*keys: str) -> None:
    if keys:
        _redis().delete(*keys)
    for k in keys:
        _hot.delete(k)


# ── Key builders ───────────────────────────────────────────────────────────────

def _page_key(question_id: str, page_num: int) -> str:
    return f"sparkl:v1:page:{question_id}:{page_num}"

def _meta_key(question_id: str) -> str:
    return f"sparkl:v1:qmeta:{question_id}"

def _uploader_key(user_id: str) -> str:
    return f"sparkl:v1:uploader:{user_id}"

def _pagecount_key(question_id: str) -> str:
    return f"sparkl:v1:pagecount:{question_id}"


# ── Public API: Base page images ───────────────────────────────────────────────

def get_base_page(question_id: str, page_num: int) -> Optional[bytes]:
    """Return cached raw JPEG bytes (no watermark), or None on miss."""
    return _get(_page_key(question_id, page_num))


def set_base_page(question_id: str, page_num: int, jpeg_bytes: bytes) -> None:
    """Cache rendered JPEG bytes (no watermark) for this page."""
    _set(_page_key(question_id, page_num), jpeg_bytes, TTL_PAGE)


# ── Public API: Question metadata ──────────────────────────────────────────────

def get_question_meta(question_id: str) -> Optional[dict]:
    raw = _get(_meta_key(question_id))
    if raw is None:
        return None
    try:
        return pickle.loads(raw)
    except Exception:
        return None


def set_question_meta(question_id: str, meta: dict) -> None:
    _set(_meta_key(question_id), pickle.dumps(meta), TTL_QUESTION)


# ── Public API: Uploader name ──────────────────────────────────────────────────

def get_uploader_name(user_id: str) -> Optional[str]:
    raw = _get(_uploader_key(user_id))
    return raw.decode() if raw else None


def set_uploader_name(user_id: str, name: str) -> None:
    _set(_uploader_key(user_id), name.encode(), TTL_UPLOADER)


# ── Public API: Page count ─────────────────────────────────────────────────────

def get_page_count(question_id: str) -> Optional[int]:
    raw = _get(_pagecount_key(question_id))
    return int(raw) if raw else None


def set_page_count(question_id: str, count: int) -> None:
    _set(_pagecount_key(question_id), str(count).encode(), TTL_PAGECOUNT)


# ── Public API: Invalidation ───────────────────────────────────────────────────

def invalidate_question(question_id: str, max_pages: int = 200) -> None:
    """
    Hard-delete ALL cached data for a question.
    Call from your admin router on update / re-upload / delete.
    Uses a Redis pipeline so it's one round-trip regardless of page count.
    """
    keys = (
        [_meta_key(question_id), _pagecount_key(question_id)]
        + [_page_key(question_id, p) for p in range(1, max_pages + 1)]
    )
    pipe = _redis().pipeline(transaction=False)
    for k in keys:
        pipe.delete(k)
        _hot.delete(k)
    pipe.execute()


# ── Debug / health ─────────────────────────────────────────────────────────────

def cache_stats() -> dict:
    try:
        info = _redis().info("memory")
        mem  = {
            "used_memory_human":     info.get("used_memory_human"),
            "maxmemory_human":       info.get("maxmemory_human"),
            "maxmemory_policy":      info.get("maxmemory_policy"),
        }
    except Exception as e:
        mem = {"error": str(e)}

    return {
        "redis_ok":       redis_ok(),
        "redis_url_set":  bool(REDIS_URL),
        "hot_cache_size": _hot.size,
        "hot_cache_max":  _HOT_MAX,
        "redis_memory":   mem,
        "ttls": {
            "page_image_s":  TTL_PAGE,
            "question_meta_s": TTL_QUESTION,
            "uploader_name_s": TTL_UPLOADER,
            "page_count_s":  TTL_PAGECOUNT,
        },
    }
