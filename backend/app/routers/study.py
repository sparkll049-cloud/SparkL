"""
routers/study.py
----------------
SparkL Cram — AI study assistant.
Gated by subscription tier:
  - Free    → no access
  - Pro     → chat, summary, explain only · max 3 sessions
  - Premium → all modes (incl. quiz) · unlimited sessions

Add to requirements.txt:
  pypdf>=4.0.0
  python-docx>=1.1.0
  groq>=0.9.0
  google-generativeai>=0.7.0
"""

from __future__ import annotations

import base64
import io
import os
import uuid
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

# ── Cost controls ──────────────────────────────────────────────────────────────

MAX_CONTEXT_CHARS = 12_000
MAX_FILE_MB       = 10
MAX_FILE_BYTES    = MAX_FILE_MB * 1024 * 1024

GROQ_MODEL   = "openai/gpt-oss-120b"
GEMINI_MODEL = "gemini-3.5-flash"

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
    note = " (truncated — file too large, showing start and end)" if was_cut else ""
    return f"=== Student Notes: {source_label}{note} ===\n\n{truncated}\n\n=== End of Notes ==="


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


# ── Models ─────────────────────────────────────────────────────────────────────

class CramSessionRow(BaseModel):
    id:          str
    title:       str
    source_type: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_cram_limits(user_id: str) -> dict:
    """Return cram-specific limits for this user. Raises 403 if no access."""
    limits = get_user_limits(user_id)
    if not limits.get("cram_access"):
        raise HTTPException(
            status_code=403,
            detail="SparkL Cram is available on Pro and Premium plans. Upgrade to access."
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


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/session", response_model=CramSessionRow)
async def create_session(
    title:       str = Form(...),
    source_type: str = Form(...),
    user_id:     str = Depends(get_current_user),
):
    limits = _get_cram_limits(user_id)

    if source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid source_type. Use: {VALID_SOURCE_TYPES}")

    # Pro session cap
    max_sessions = limits.get("cram_max_sessions")
    if max_sessions is not None:
        count = _count_user_sessions(user_id)
        if count >= max_sessions:
            raise HTTPException(
                status_code=403,
                detail=f"Pro plan allows {max_sessions} Cram sessions. Upgrade to Premium for unlimited."
            )

    session_id = str(uuid.uuid4())
    try:
        supabase.table("cram_sessions").insert({
            "id":          session_id,
            "user_id":     user_id,
            "title":       title[:120],
            "source_type": source_type,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create session: {e}")

    return CramSessionRow(id=session_id, title=title, source_type=source_type)


@router.post("/chat")
async def study_chat(
    file:         UploadFile | None = File(None),
    text_content: str | None        = Form(None),
    message:      str               = Form(...),
    history:      str               = Form("[]"),
    mode:         str               = Form("chat"),
    user_id:      str               = Depends(get_current_user),
):
    import json

    limits       = _get_cram_limits(user_id)
    allowed_modes: list = limits.get("cram_modes", [])

    if mode not in allowed_modes:
        raise HTTPException(
            status_code=403,
            detail=f"'{mode}' mode is not available on your plan. Upgrade to Premium for Quiz mode."
        )

    # ── History ────────────────────────────────────────────────────────
    try:
        raw_history: list[dict] = json.loads(history)
        raw_history = raw_history[-12:]
    except Exception:
        raw_history = []

    # ── Mode prefix ────────────────────────────────────────────────────
    mode_prefix = {
        "quiz":    "Generate 5 practice questions (mix MCQ and theory) from the notes below. For MCQ include options A–D and the correct answer.",
        "summary": "Summarise the key points from the notes below in clear bullet points. Group by topic.",
        "explain": "Explain the main concepts from the notes below simply, as if teaching a student seeing this topic for the first time.",
        "chat":    "",
    }.get(mode, "")

    full_message = f"{mode_prefix}\n\n{message}".strip() if mode_prefix else message

    # ── Process file ───────────────────────────────────────────────────
    context_block = ""
    is_image      = False
    image_b64     = ""
    image_mime    = ""
    source_label  = "Uploaded notes"

    if file and file.filename:
        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"File too large — max {MAX_FILE_MB} MB.")

        fname        = file.filename.lower()
        mime         = file.content_type or ""
        source_label = file.filename

        if fname.endswith(".pdf") or "pdf" in mime:
            raw_text      = _extract_pdf(file_bytes)
            context_block = _build_context_block(raw_text, source_label)
        elif fname.endswith(".docx") or "wordprocessingml" in mime:
            raw_text      = _extract_docx(file_bytes)
            context_block = _build_context_block(raw_text, source_label)
        elif mime.startswith("image/") or fname.endswith((".jpg", ".jpeg", ".png", ".webp")):
            is_image   = True
            image_b64  = base64.b64encode(file_bytes).decode()
            image_mime = mime or "image/jpeg"
        elif fname.endswith(".txt"):
            raw_text      = file_bytes.decode("utf-8", errors="replace")
            context_block = _build_context_block(raw_text, source_label)
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type. Use PDF, DOCX, image, or plain text.")

    elif text_content:
        context_block = _build_context_block(text_content, "Pasted text")

    # ── Image → Gemini ─────────────────────────────────────────────────
    if is_image:
        history_text = "\n".join(
            f"{'Student' if m['role'] == 'user' else 'SparkL Cram'}: {m['content']}"
            for m in raw_history
        )
        return StreamingResponse(
            _stream_gemini_image(image_b64, image_mime, full_message, history_text),
            media_type="text/plain",
        )

    # ── Text → Groq ────────────────────────────────────────────────────
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if context_block:
        messages.append({"role": "user",      "content": f"Here are my study notes:\n\n{context_block}"})
        messages.append({"role": "assistant", "content": "Got it! I've read through your notes. What would you like to do — ask questions, get a summary, practice quiz, or have me explain something?"})

    for m in raw_history:
        if m.get("role") in ("user", "assistant") and m.get("content"):
            messages.append({"role": m["role"], "content": m["content"]})

    messages.append({"role": "user", "content": full_message})

    return StreamingResponse(_stream_groq(messages), media_type="text/plain")


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


@router.get("/limits")
async def get_cram_limits(user_id: str = Depends(get_current_user)):
    """Frontend calls this to know the user's Cram tier before rendering."""
    limits     = get_user_limits(user_id)
    session_count = _count_user_sessions(user_id) if limits.get("cram_access") else 0
    return {
        "plan":             limits.get("plan", "free"),
        "cram_access":      limits.get("cram_access", False),
        "cram_max_sessions": limits.get("cram_max_sessions"),
        "cram_modes":       limits.get("cram_modes", []),
        "sessions_used":    session_count,
    }


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