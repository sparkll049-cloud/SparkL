import time
from typing import Any, Callable, Dict, Tuple

_cache: Dict[str, Tuple[float, Any]] = {}


def cached(key: str, ttl_seconds: int, fetch_fn: Callable[[], Any]) -> Any:
    """Return the cached value for `key` if still within ttl_seconds,
    otherwise call fetch_fn(), store the result, and return it."""
    now = time.time()
    if key in _cache:
        cached_at, value = _cache[key]
        if now - cached_at < ttl_seconds:
            return value

    value = fetch_fn()
    _cache[key] = (now, value)
    return value


def invalidate(key: str) -> None:
    _cache.pop(key, None)
