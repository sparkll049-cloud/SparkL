"""
routers/study.py
----------------
SparkL Cram — AI study assistant.
- Groq first for text/PDF/DOCX, Gemini fallback if Groq fails
- Gemini always for images and URLs (native support)
- Quiz mode returns structured JSON for interactive UI
- Messages persisted, cleaned after 7 days
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth import get_current_user
from app.supabase_client import supabase
from app.services.subscription import get_user_limits

try:
    from groq import AsyncGroq
except ImportError:
    AsyncGroq = None

try:
    from google import genai as genai_sdk
    from google.genai import types as genai_types
except ImportError:
    genai_sdk = None
    genai_types = None

router = APIRouter(prefix="/api/study", tags=["study"])

# ── Constants ──────────────────────────────────────────────────────────────────

MAX_CONTEXT_CHARS = 12_000
MAX_FILE_MB       = 10
MAX_FILE_BYTES    = MAX_FILE_MB * 1024 * 1024
MAX_HISTORY_MSGS  = 8
MESSAGE_TTL_DAYS  = 7

GROQ_MODEL   = "openai/gpt-oss-120b"
GEMINI_MODEL = "gemini-2.0-flash"

VALID_SOURCE_TYPES = {"pdf", "docx", "image", "text", "url"}

# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are SparkL Cram — a smart, friendly AI tutor helping Nigerian polytechnic and university students understand their course material.

Rules:
- Be concise and clear — students are on mobile, keep answers focused
- Use simple language; avoid unnecessary jargon
- Always relate explanations to Nigerian tertiary education context where relevant
- Never make up facts not in the provided material
- If asked something not in the notes, say so honestly
- Always respond in clean markdown (use **bold**, bullet points, tables where helpful)"""

QUIZ_SYSTEM_PROMPT = """You are SparkL Cram — a quiz generator for Nigerian university and polytechnic students.

Generate exactly 5 quiz questions from the provided study material.
Mix MCQ (4 options) and theory (short answer) questions.
Return ONLY valid JSON, no markdown fences, no preamble, no explanation.

Format:
{
  "questions": [
    {
      "type": "mcq",
      "question": "Question text here",
      "options": ["A. option", "B. option", "C. option", "D. option"],
      "answer": "A. option",
      "explanation": "Brief reason why this is correct"
    },
    {
      "type": "theory",
      "question": "Question text here",
      "answer": "Model answer here",
      "explanation": "Key points to include"
    }
  ]
}"""

# ── Extractors ─────────────────────────────────────────────────────────────────

def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(p.extract_text() or "" for p in reader.pages).strip()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {e}")


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read DOCX: {e}")


def _truncate(text: str) -> tuple[str, bool]:
    if len(text) <= MAX_CONTEXT_CHARS:
        return text, False
    half = MAX_CONTEXT_CHARS // 2
    return (
        text[:half] + "\n\n...[middle omitted]...\n\n" + text[-half:],
        True,
    )


def _build_context_block(text: str, label: str) -> str:
    truncated, was_cut = _truncate(text)
    note = " (truncated)" if was_cut else ""
    return f"=== Study Notes: {label}{note} ===\n\n{truncated}\n\n=== End ==="


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _save_messages(session_id: str, user_id: str, messages: list[dict]) -> None:
    rows = [
        {"session_id": session_id, "user_id": user_id,
         "role": m["role"], "content": m["content"]}
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    if rows:
        supabase.table("cram_messages").insert(rows).execute()


def _load_messages(session_id: str, limit: int = MAX_HISTORY_MSGS) -> list[dict]:
    try:
        res = (
            supabase.table("cram_messages")
            .select("role, content, created_at")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(reversed(res.data or []))
    except Exception:
        return []


def _cleanup_old_messages() -> None:
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=MESSAGE_TTL_DAYS)).isoformat()
        supabase.table("cram_messages").delete().lt("created_at", cutoff).execute()
    except Exception:
        pass


def _get_session(session_id: str, user_id: str) -> dict:
    try:
        res = (
            supabase.table("cram_sessions")
            .select("id, title, source_type, extracted_text, source_url")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Session not found.")
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Gemini client ──────────────────────────────────────────────────────────────

def _get_gemini_client():
    if genai_sdk is None:
        raise HTTPException(status_code=500, detail="google-genai not installed.")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set.")
    return genai_sdk.Client(api_key=api_key)


# ── Groq streaming ─────────────────────────────────────────────────────────────

async def _stream_groq(messages: list[dict]) -> AsyncGenerator[str, None]:
    if AsyncGroq is None:
        raise RuntimeError("groq not installed")
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    client = AsyncGroq(api_key=api_key)
    stream = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=1024,
        stream=True,
        temperature=0.4,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


# ── Gemini streaming (text/context) ───────────────────────────────────────────

async def _stream_gemini_text(
    prompt: str,
    history_text: str = "",
    system: str = SYSTEM_PROMPT,
) -> AsyncGenerator[str, None]:
    client = _get_gemini_client()
    full   = f"{history_text}\n\nStudent: {prompt}" if history_text else prompt
    async for chunk in await client.aio.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=full,
        config=genai_types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=1024,
            temperature=0.4,
        ),
    ):
        if chunk.text:
            yield chunk.text


# ── Gemini streaming (image) ───────────────────────────────────────────────────

async def _stream_gemini_image(
    image_b64: str,
    mime_type: str,
    prompt: str,
    history_text: str = "",
) -> AsyncGenerator[str, None]:
    client     = _get_gemini_client()
    full       = f"{history_text}\n\nStudent: {prompt}" if history_text else prompt
    image_data = base64.b64decode(image_b64)
    async for chunk in await client.aio.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=[
            genai_types.Part(
                inline_data=genai_types.Blob(mime_type=mime_type, data=image_data)
            ),
            genai_types.Part(text=full),
        ],
        config=genai_types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=1024,
            temperature=0.4,
        ),
    ):
        if chunk.text:
            yield chunk.text


# ── URL content fetcher ────────────────────────────────────────────────────────

async def _fetch_url_content(url: str) -> str:
    """
    Fetch a web page or YouTube transcript and return as plain text.
    For YouTube URLs, uses youtube-transcript-api to get the transcript.
    For regular URLs, fetches and strips HTML.
    """
    import re
    import httpx

    is_youtube = bool(re.search(r"(youtube\.com/watch|youtu\.be/)", url))

    if is_youtube:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            vid_match = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
            if not vid_match:
                raise HTTPException(status_code=422, detail="Could not extract YouTube video ID.")
            video_id  = vid_match.group(1)
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
            text = " ".join(entry["text"] for entry in transcript)
            if len(text) > 10_000:
                text = text[:10_000] + "\n\n...[transcript truncated]..."
            return text
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not get YouTube transcript: {e}")

    # Regular web URL — fetch and strip HTML
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SparkLCram/1.0)"}
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        html = resp.text

    clean = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL)
    clean = re.sub(r"<script[^>]*>.*?</script>", " ", clean, flags=re.DOTALL)
    clean = re.sub(r"<[^>]+>", " ", clean)
    clean = re.sub(r"\s{2,}", " ", clean).strip()

    if len(clean) > 10_000:
        clean = clean[:10_000] + "\n\n...[content truncated]..."

    if not clean or len(clean) < 50:
        raise HTTPException(
            status_code=422,
            detail="Could not extract readable content from this URL. Try pasting the text directly instead."
        )

    return clean


# ── Gemini streaming (URL / YouTube) ──────────────────────────────────────────

async def _stream_gemini_url(
    url: str,
    prompt: str,
    history_text: str = "",
) -> AsyncGenerator[str, None]:
    # Fetch URL content as plain text first
    try:
        page_content = await _fetch_url_content(url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL: {e}")

    client = _get_gemini_client()
    full   = f"{history_text}\n\nStudent: {prompt}" if history_text else prompt
    context = f"=== Content from {url} ===\n\n{page_content}\n\n=== End ==="

    async for chunk in await client.aio.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=f"{context}\n\n{full}",
        config=genai_types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=1024,
            temperature=0.4,
        ),
    ):
        if chunk.text:
            yield chunk.text


# ── Groq → Gemini fallback for text ───────────────────────────────────────────

async def _stream_text_with_fallback(
    groq_messages: list[dict],
    gemini_prompt: str,
    history_text:  str,
) -> AsyncGenerator[str, None]:
    try:
        got_any = False
        async for chunk in _stream_groq(groq_messages):
            got_any = True
            yield chunk
        if got_any:
            return
    except Exception as e:
        print(f"[Groq failed, falling back to Gemini] {e}")

    async for chunk in _stream_gemini_text(gemini_prompt, history_text):
        yield chunk


# ── Quiz generation (non-streaming, returns JSON) ─────────────────────────────

async def _generate_quiz_groq(messages: list[dict]) -> dict:
    if AsyncGroq is None:
        raise RuntimeError("groq not installed")
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    client   = AsyncGroq(api_key=api_key)
    response = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=2048,
        stream=False,
        temperature=0.5,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


async def _generate_quiz_gemini(context: str) -> dict:
    client   = _get_gemini_client()
    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=f"Generate a quiz from these study notes:\n\n{context}",
        config=genai_types.GenerateContentConfig(
            system_instruction=QUIZ_SYSTEM_PROMPT,
            max_output_tokens=2048,
            temperature=0.5,
        ),
    )
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


async def _generate_quiz_gemini_url(url: str) -> dict:
    page_content = await _fetch_url_content(url)
    client       = _get_gemini_client()
    context      = f"=== Content from {url} ===\n\n{page_content}\n\n=== End ==="
    response     = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=f"{context}\n\nGenerate a quiz from this content.",
        config=genai_types.GenerateContentConfig(
            system_instruction=QUIZ_SYSTEM_PROMPT,
            max_output_tokens=2048,
            temperature=0.5,
        ),
    )
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


async def _generate_quiz_gemini_image(image_b64: str, mime_type: str) -> dict:
    client     = _get_gemini_client()
    image_data = base64.b64decode(image_b64)
    response   = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            genai_types.Part(
                inline_data=genai_types.Blob(mime_type=mime_type, data=image_data)
            ),
            genai_types.Part(text="Generate a quiz from this image."),
        ],
        config=genai_types.GenerateContentConfig(
            system_instruction=QUIZ_SYSTEM_PROMPT,
            max_output_tokens=2048,
            temperature=0.5,
        ),
    )
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


async def _generate_quiz_with_fallback(
    context:     str,
    groq_msgs:   list[dict],
    source_type: str,
    image_b64:   str = "",
    mime_type:   str = "",
    url:         str = "",
) -> dict:
    if source_type == "url":
        return await _generate_quiz_gemini_url(url)
    if source_type == "image":
        return await _generate_quiz_gemini_image(image_b64, mime_type)
    try:
        return await _generate_quiz_groq(groq_msgs)
    except Exception as e:
        print(f"[Quiz Groq failed, falling back to Gemini] {e}")
        return await _generate_quiz_gemini(context)


# ── Subscription helpers ───────────────────────────────────────────────────────

def _get_cram_limits(user_id: str) -> dict:
    limits = get_user_limits(user_id)
    if not limits.get("cram_access"):
        raise HTTPException(
            status_code=403,
            detail="SparkL Cram is available on Pro and Premium plans."
        )
    return limits


def _count_user_sessions(user_id: str) -> int:
    try:
        res = (
            supabase.table("cram_sessions")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        return res.count or 0
    except Exception:
        return 0


# ── Models ─────────────────────────────────────────────────────────────────────

class CramSessionRow(BaseModel):
    id:          str
    title:       str
    source_type: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/session", response_model=CramSessionRow)
async def create_session(
    title:        str               = Form(...),
    source_type:  str               = Form(...),
    file:         UploadFile | None = File(None),
    text_content: str | None        = Form(None),
    source_url:   str | None        = Form(None),
    user_id:      str               = Depends(get_current_user),
):
    limits = _get_cram_limits(user_id)

    if source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail="Invalid source_type.")

    max_sessions = limits.get("cram_max_sessions")
    if max_sessions is not None:
        if _count_user_sessions(user_id) >= max_sessions:
            raise HTTPException(
                status_code=403,
                detail=f"Pro plan allows {max_sessions} Cram sessions. Upgrade to Premium for unlimited."
            )

    extracted_text: str | None = None
    stored_url:     str | None = None

    if source_type == "url":
        if not source_url:
            raise HTTPException(status_code=422, detail="source_url is required for URL sessions.")
        stored_url = source_url.strip()

    elif file and file.filename:
        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"File too large — max {MAX_FILE_MB} MB.")
        fname = file.filename.lower()
        mime  = file.content_type or ""
        if fname.endswith(".pdf") or "pdf" in mime:
            extracted_text = _extract_pdf(file_bytes)
        elif fname.endswith(".docx") or "wordprocessingml" in mime:
            extracted_text = _extract_docx(file_bytes)
        elif fname.endswith(".txt"):
            extracted_text = file_bytes.decode("utf-8", errors="replace")
        elif mime.startswith("image/") or fname.endswith((".jpg", ".jpeg", ".png", ".webp")):
            extracted_text = None  # handled at chat time via Gemini
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type.")

    elif text_content:
        extracted_text = text_content

    session_id = str(uuid.uuid4())
    try:
        supabase.table("cram_sessions").insert({
            "id":             session_id,
            "user_id":        user_id,
            "title":          title[:120],
            "source_type":    source_type,
            "extracted_text": extracted_text,
            "source_url":     stored_url,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create session: {e}")

    return CramSessionRow(id=session_id, title=title, source_type=source_type)


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user_id:    str = Depends(get_current_user),
):
    _get_cram_limits(user_id)
    _get_session(session_id, user_id)
    return _load_messages(session_id)


@router.post("/chat")
async def study_chat(
    session_id: str               = Form(...),
    message:    str               = Form(...),
    mode:       str               = Form("chat"),
    file:       UploadFile | None = File(None),
    user_id:    str               = Depends(get_current_user),
):
    limits        = _get_cram_limits(user_id)
    allowed_modes = limits.get("cram_modes", [])

    if mode not in allowed_modes:
        raise HTTPException(status_code=403, detail=f"'{mode}' mode is not available on your plan.")

    session        = _get_session(session_id, user_id)
    extracted_text = session.get("extracted_text")
    source_type    = session.get("source_type", "text")
    source_url     = session.get("source_url")
    raw_history    = _load_messages(session_id, limit=MAX_HISTORY_MSGS)

    asyncio.get_event_loop().run_in_executor(None, _cleanup_old_messages)

    # ── Image handling ─────────────────────────────────────────────────
    is_image   = False
    image_b64  = ""
    image_mime = ""

    if file and file.filename:
        file_bytes = await file.read()
        mime       = file.content_type or ""
        if mime.startswith("image/") or file.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            is_image   = True
            image_b64  = base64.b64encode(file_bytes).decode()
            image_mime = mime or "image/jpeg"

    # ── History text (for Gemini context) ─────────────────────────────
    history_text = "\n".join(
        f"{'Student' if m['role'] == 'user' else 'SparkL Cram'}: {m['content']}"
        for m in raw_history
    )

    # ── Mode prefix ────────────────────────────────────────────────────
    mode_prefix = {
        "summary": "Summarise the key points from the notes below in clear bullet points grouped by topic.",
        "explain": "Explain the main concepts from the notes below simply, as if teaching a student seeing this for the first time.",
        "chat":    "",
        "quiz":    "",
    }.get(mode, "")

    full_message = f"{mode_prefix}\n\n{message}".strip() if mode_prefix else message

    # ── Quiz mode — return JSON, not a stream ──────────────────────────
    if mode == "quiz":
        context = extracted_text or ""
        groq_quiz_messages = [
            {"role": "system", "content": QUIZ_SYSTEM_PROMPT},
            {"role": "user",   "content": f"Generate a quiz from these notes:\n\n{_build_context_block(context, session['title'])}"},
        ]
        try:
            quiz_data = await _generate_quiz_with_fallback(
                context     = context,
                groq_msgs   = groq_quiz_messages,
                source_type = source_type,
                image_b64   = image_b64,
                mime_type   = image_mime,
                url         = source_url or "",
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Quiz generation failed: {e}")

        _save_messages(session_id, user_id, [
            {"role": "user",      "content": "[Quiz requested]"},
            {"role": "assistant", "content": f"__QUIZ__:{json.dumps(quiz_data)}"},
        ])

        from fastapi.responses import JSONResponse
        return JSONResponse({"type": "quiz", "data": quiz_data})

    # ── Save user message ──────────────────────────────────────────────
    _save_messages(session_id, user_id, [{"role": "user", "content": full_message}])

    # ── Image → Gemini ─────────────────────────────────────────────────
    if is_image or source_type == "image":
        async def gemini_image_stream():
            ai_text = ""
            async for chunk in _stream_gemini_image(image_b64, image_mime, full_message, history_text):
                ai_text += chunk
                yield chunk
            _save_messages(session_id, user_id, [{"role": "assistant", "content": ai_text}])

        return StreamingResponse(gemini_image_stream(), media_type="text/plain")

    # ── URL → Gemini ───────────────────────────────────────────────────
    if source_type == "url" and source_url:
        async def gemini_url_stream():
            ai_text = ""
            async for chunk in _stream_gemini_url(source_url, full_message, history_text):
                ai_text += chunk
                yield chunk
            _save_messages(session_id, user_id, [{"role": "assistant", "content": ai_text}])

        return StreamingResponse(gemini_url_stream(), media_type="text/plain")

    # ── Text/PDF/DOCX → Groq with Gemini fallback ─────────────────────
    context_block = _build_context_block(extracted_text, session["title"]) if extracted_text else ""

    groq_messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if context_block:
        groq_messages.append({"role": "user",      "content": f"Here are my study notes:\n\n{context_block}"})
        groq_messages.append({"role": "assistant", "content": "Got it! I've read through your notes. What would you like to do?"})
    for m in raw_history:
        if m.get("role") in ("user", "assistant") and m.get("content"):
            groq_messages.append({"role": m["role"], "content": m["content"]})
    groq_messages.append({"role": "user", "content": full_message})

    gemini_prompt = f"{context_block}\n\n{full_message}" if context_block else full_message

    async def text_stream():
        ai_text = ""
        async for chunk in _stream_text_with_fallback(groq_messages, gemini_prompt, history_text):
            ai_text += chunk
            yield chunk
        _save_messages(session_id, user_id, [{"role": "assistant", "content": ai_text}])

    return StreamingResponse(text_stream(), media_type="text/plain")


@router.get("/limits")
async def get_cram_limits(user_id: str = Depends(get_current_user)):
    limits        = get_user_limits(user_id)
    session_count = _count_user_sessions(user_id) if limits.get("cram_access") else 0
    return {
        "plan":              limits.get("plan", "free"),
        "cram_access":       limits.get("cram_access", False),
        "cram_max_sessions": limits.get("cram_max_sessions"),
        "cram_modes":        limits.get("cram_modes", []),
        "sessions_used":     session_count,
    }


@router.get("/sessions")
async def list_sessions(user_id: str = Depends(get_current_user)):
    _get_cram_limits(user_id)
    try:
        res = (
            supabase.table("cram_sessions")
            .select("id, title, source_type, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user_id:    str = Depends(get_current_user),
):
    _get_cram_limits(user_id)
    try:
        supabase.table("cram_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
