"""
app/services/safe_fetch.py

Controlled server-side fetcher for user-supplied URLs.
  - http/https only, standard ports only, no credentials in the URL
  - blocks private, loopback, link-local, metadata and other non-public IPs
  - follows redirects manually and re-checks every hop
  - caps redirects, bytes (after decompression), total time and content type
  - returns cleaned text only, never raw HTML

Known limit: DNS is checked before connecting, so a DNS-rebinding attacker could
still race the lookup. For stronger protection, run fetches from a network with
no route to internal services.
"""

from __future__ import annotations

import asyncio
import html as html_lib
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx

from app.services.tutor_policy import LIMITS

ALLOWED_TYPES = {"text/html", "text/plain", "application/xhtml+xml"}
UA = {"User-Agent": "Mozilla/5.0 (compatible; SparkLCram/1.0)"}
YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}


class FetchError(Exception):
    """Safe-to-show error message."""


def _is_youtube(host: str) -> bool:
    return (host or "").lower() in YOUTUBE_HOSTS


async def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise FetchError("Only http and https links are supported.")
    if not parsed.hostname:
        raise FetchError("That link is not valid.")
    if parsed.username or parsed.password:
        raise FetchError("Links with embedded credentials are not allowed.")
    if parsed.port not in (None, 80, 443):
        raise FetchError("That link uses an unsupported port.")

    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(parsed.hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise FetchError("Could not find that website.")

    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if not ip.is_global:
            raise FetchError("That address is not allowed.")


def _clean_html(raw: str, max_chars: int) -> str:
    text = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    if len(text) < 50:
        raise FetchError(
            "Could not read any text from that page. Try pasting the text directly."
        )
    return text[:max_chars]


async def _fetch_page(url: str, max_chars: int) -> str:
    max_bytes = LIMITS["max_url_fetch_bytes"]
    max_redirects = LIMITS["max_url_redirects"]
    current = url

    async with httpx.AsyncClient(follow_redirects=False, headers=UA, timeout=15) as client:
        for _ in range(max_redirects + 1):
            await _validate_url(current)
            async with client.stream("GET", current) as resp:
                if resp.status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    if not location:
                        raise FetchError("The link redirected to nowhere.")
                    current = urljoin(current, location)
                    continue
                if resp.status_code != 200:
                    raise FetchError(f"The page returned an error (status {resp.status_code}).")

                ctype = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                if ctype not in ALLOWED_TYPES:
                    raise FetchError("Only web pages and plain text links are supported.")

                body = bytearray()
                async for part in resp.aiter_bytes():
                    body.extend(part)
                    if len(body) > max_bytes:
                        raise FetchError("That page is too large.")
                raw = body.decode(resp.encoding or "utf-8", errors="replace")
                return _clean_html(raw, max_chars) if ctype != "text/plain" else raw[:max_chars]
    raise FetchError("That link redirected too many times.")


async def _fetch_youtube(url: str, max_chars: int) -> str:
    m = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
    if not m:
        raise FetchError("Could not find a video ID in that YouTube link.")
    video_id = m.group(1)

    def _get() -> str:
        from youtube_transcript_api import YouTubeTranscriptApi

        api = YouTubeTranscriptApi()
        if hasattr(api, "fetch"):  # v1.x
            return " ".join(s.text for s in api.fetch(video_id))
        entries = YouTubeTranscriptApi.get_transcript(video_id)  # v0.x
        return " ".join(e["text"] for e in entries)

    try:
        text = await asyncio.get_running_loop().run_in_executor(None, _get)
    except Exception:
        raise FetchError(
            "Could not get captions for that video. It may be private, age-restricted or have no captions."
        )
    if len(text.strip()) < 50:
        raise FetchError("That video has no usable captions.")
    return text[:max_chars]


async def fetch_url_text(url: str, max_chars: int | None = None) -> str:
    """Fetch a public web page or YouTube transcript and return clean text."""
    url = url.strip()
    max_chars = max_chars or LIMITS["max_text_chars"]
    host = (urlparse(url).hostname or "").lower()
    timeout = LIMITS["max_url_fetch_seconds"]
    try:
        coro = _fetch_youtube(url, max_chars) if _is_youtube(host) else _fetch_page(url, max_chars)
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        raise FetchError("That link took too long to load.")
    except httpx.HTTPError:
        raise FetchError("Could not load that link.")


def is_youtube_url(url: str) -> bool:
    return _is_youtube((urlparse(url.strip()).hostname or "").lower())
