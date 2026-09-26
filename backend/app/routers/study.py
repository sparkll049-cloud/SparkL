"""
routers/study.py
----------------
SparkL Cram — AI study assistant.
- Extracted text saved to cram_sessions (no file storage)
- Chat messages persisted in cram_messages (last 8 loaded on reopen)
- Messages older than 7 days auto-cleaned on every chat request (background)
- Gated by subscription tier
"""

from __future__ import annotations

import asyncio
import base64
import io
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth import get_current_user
from app.supabase_client import supabase
from app.services.subscription import get_user_limits

try:
    from groq import AsyncGroq
except ImportError:
    AsyncGroq = None  # type: ignore

try:
    import google.generativeai as genai
except ImportError:
    genai = None  # type: ignore

router = APIRouter(prefix="/api/study", tags=["study"])

# ── Constants ──────────────────────────────────────────────────────────────────

MAX_CONTEXT_CHARS = 12_000
MAX_FILE_MB       = 10
MAX_FILE_BYTES    = MAX_FILE_MB * 1024 * 1024
MAX_HISTORY_MSGS  = 8
MESSAGE_TTL_DAYS  = 7

GROQ_MODEL   = "llama3-8b-8192"
GEMINI_MODEL = "gemini-1.5-flash"

VALID_SOURCE_TYPES = {"pdf", "docx", "image", "text"}

# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are SparkL Cram — a smart, friendly AI tutor helping Nigerian polytechnic and university students understand their course material.

The student has shared their notes or study material with you. Your job is to help them study effectively.

Rules:
- Be concise and clear — students are on mobile, keep answers focused
- Use simple language; avoid unnecessary jargon
- When generating quiz questions, mix MCQ and theory
- Always relate explanations to Nigerian tertiary education context where relevant
- Never make up facts not in the provided material
- If asked something not covered in the notes, say so honestly
- Always respond in clean markdown (use **bold**, bullet points, tables where helpful)"""

# ── Extractors ─────────────────────────────────────────────────────────────────

def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        pages  = [p.extract_text() or "" for p in reader.pages]
        return "\n\n".join(pages).strip()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {e}")


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
        doc  = Document(io.BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read DOCX: {e}")


def _truncate(text: str) -> tuple[str, bool]:
    if len(text) <= MAX_CONTEXT_CHARS:
        return text, False
    half = MAX_CONTEXT_CHARS // 2
    return (
        text[:half] + "\n\n...[middle section omitted to save tokens]...\n\n" + text[-half:],
        True,
    )


def _build_context_block(text: str, source_label: str) -> str:
    truncated, was_cut = _truncate(text)
    note = " (truncated)" if was_cut else ""
    return f"=== Student Notes: {source_label}{note} ===\n\n{truncated}\n\n=== End of Notes ==="


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _save_messages(session_id: str, user_id: str, messages: list[dict]) -> None:
    """Persist a batch of messages to cram_messages."""
    if not messages:
        return
    rows = [
        {
            "session_id": session_id,
            "user_id":    user_id,
            "role":       m["role"],
            "content":    m["content"],
        }
        for m in messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    if rows:
        supabase.table("cram_messages").insert(rows).execute()


def _load_messages(session_id: str, limit: int = MAX_HISTORY_MSGS) -> list[dict]:
    """Load the last N messages for a session, oldest first."""
    try:
        res = (
            supabase.table("cram_messages")
            .select("role, content, created_at")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        messages = res.data or []
        # Reverse so oldest is first (desc query → reverse for chronological)
        return list(reversed(messages))
    except Exception:
        return []


def _cleanup_old_messages() -> None:
    """Delete messages older than MESSAGE_TTL_DAYS. Fire-and-forget."""
    try:
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=MESSAGE_TTL_DAYS)
        ).isoformat()
        supabase.table("cram_messages").delete().lt("created_at", cutoff).execute()
    except Exception:
        pass


def _get_session(session_id: str, user_id: str) -> dict:
    """Fetch a session row, verify ownership."""
    try:
        res = (
            supabase.table("cram_sessions")
            .select("id, title, source_type, extracted_text")
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


# ── Groq streaming ─────────────────────────────────────────────────────────────

async def _stream_groq(messages: list[dict]) -> AsyncGenerator[str, None]:
    if AsyncGroq is None:
        raise HTTPException(status_code=500, detail="groq package not installed.")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set.")

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


# ── Gemini (image inputs) ──────────────────────────────────────────────────────

async def _stream_gemini_image(
    image_b64: str,
    mime_type: str,
    user_message: str,
    history_text: str,
) -> AsyncGenerator[str, None]:
    if genai is None:
        raise HTTPException(status_code=500, detail="google-generativeai not installed.")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
    )

    image_data = base64.b64decode(image_b64)
    image_part = {"mime_type": mime_type, "data": image_data}
    prompt     = f"{history_text}\n\nStudent: {user_message}" if history_text else user_message

    response = await model.generate_content_async(
        [image_part, prompt],
        stream=True,
        generation_config={"max_output_tokens": 1024, "temperature": 0.4},
    )

    async for chunk in response:
        try:
            if chunk.text:
                yield chunk.text
        except Exception:
            pass


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
    title:       str               = Form(...),
    source_type: str               = Form(...),
    file:        UploadFile | None = File(None),
    text_content: str | None       = Form(None),
    user_id:     str               = Depends(get_current_user),
):
    limits = _get_cram_limits(user_id)

    if source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid source_type. Use: {VALID_SOURCE_TYPES}")

    max_sessions = limits.get("cram_max_sessions")
    if max_sessions is not None:
        count = _count_user_sessions(user_id)
        if count >= max_sessions:
            raise HTTPException(
                status_code=403,
                detail=f"Pro plan allows {max_sessions} Cram sessions. Upgrade to Premium for unlimited."
            )

    # ── Extract text from file ─────────────────────────────────────────
    extracted_text: str | None = None

    if file and file.filename:
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
            # Images can't be stored as text — handled at chat time
            extracted_text = None
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type.")

    elif text_content:
        extracted_text = text_content

    # ── Create session row ─────────────────────────────────────────────
    session_id = str(uuid.uuid4())
    try:
        supabase.table("cram_sessions").insert({
            "id":             session_id,
            "user_id":        user_id,
            "title":          title[:120],
            "source_type":    source_type,
            "extracted_text": extracted_text,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create session: {e}")

    return CramSessionRow(id=session_id, title=title, source_type=source_type)


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user_id:    str = Depends(get_current_user),
):
    """Load last 8 messages for a session."""
    _get_cram_limits(user_id)
    _get_session(session_id, user_id)  # verify ownership
    messages = _load_messages(session_id)
    return messages


@router.post("/chat")
async def study_chat(
    session_id:   str               = Form(...),
    message:      str               = Form(...),
    mode:         str               = Form("chat"),
    file:         UploadFile | None = File(None),
    user_id:      str               = Depends(get_current_user),
):
    # ── Auth + limits ──────────────────────────────────────────────────
    limits        = _get_cram_limits(user_id)
    allowed_modes: list = limits.get("cram_modes", [])

    if mode not in allowed_modes:
        raise HTTPException(
            status_code=403,
            detail=f"'{mode}' mode is not available on your plan."
        )

    # ── Load session ───────────────────────────────────────────────────
    session       = _get_session(session_id, user_id)
    extracted_text = session.get("extracted_text")

    # ── Load persisted history ─────────────────────────────────────────
    raw_history   = _load_messages(session_id, limit=MAX_HISTORY_MSGS)

    # ── Background cleanup (fire-and-forget) ───────────────────────────
    asyncio.get_event_loop().run_in_executor(None, _cleanup_old_messages)

    # ── Handle image file (re-upload needed for images) ────────────────
    is_image   = False
    image_b64  = ""
    image_mime = ""

    if file and file.filename:
        file_bytes = await file.read()
        mime       = file.content_type or ""
        fname      = file.filename.lower()
        if mime.startswith("image/") or fname.endswith((".jpg", ".jpeg", ".png", ".webp")):
            is_image   = True
            image_b64  = base64.b64encode(file_bytes).decode()
            image_mime = mime or "image/jpeg"

    # ── Mode prefix ────────────────────────────────────────────────────
    mode_prefix = {
        "quiz":    "Generate 5 practice questions (mix MCQ and theory) from the notes below. For MCQ include options A–D and the correct answer.",
        "summary": "Summarise the key points from the notes below in clear bullet points. Group by topic.",
        "explain": "Explain the main concepts from the notes below simply, as if teaching a student seeing this topic for the first time.",
        "chat":    "",
    }.get(mode, "")

    full_message = f"{mode_prefix}\n\n{message}".strip() if mode_prefix else message

    # ── Save user message ──────────────────────────────────────────────
    _save_messages(session_id, user_id, [{"role": "user", "content": full_message}])

    # ── Image path → Gemini ────────────────────────────────────────────
    if is_image:
        history_text = "\n".join(
            f"{'Student' if m['role'] == 'user' else 'SparkL Cram'}: {m['content']}"
            for m in raw_history
        )

        async def gemini_stream_and_save():
            ai_text = ""
            async for chunk in _stream_gemini_image(image_b64, image_mime, full_message, history_text):
                ai_text += chunk
                yield chunk
            _save_messages(session_id, user_id, [{"role": "assistant", "content": ai_text}])

        return StreamingResponse(gemini_stream_and_save(), media_type="text/plain")

    # ── Text path → Groq ───────────────────────────────────────────────
    context_block = (
        _build_context_block(extracted_text, session["title"])
        if extracted_text else ""
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if context_block:
        messages.append({"role": "user",      "content": f"Here are my study notes:\n\n{context_block}"})
        messages.append({"role": "assistant", "content": "Got it! I've read through your notes. What would you like to do — ask questions, get a summary, practice quiz, or have me explain something?"})

    for m in raw_history:
        if m.get("role") in ("user", "assistant") and m.get("content"):
            messages.append({"role": m["role"], "content": m["content"]})

    messages.append({"role": "user", "content": full_message})

    async def groq_stream_and_save():
        ai_text = ""
        async for chunk in _stream_groq(messages):
            ai_text += chunk
            yield chunk
        _save_messages(session_id, user_id, [{"role": "assistant", "content": ai_text}])

    return StreamingResponse(groq_stream_and_save(), media_type="text/plain")


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
        # Messages cascade-delete via FK
        supabase.table("cram_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))