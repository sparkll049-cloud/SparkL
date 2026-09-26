"""
routers/study.py
----------------
AI study assistant — processes notes in memory, nothing saved to storage.

Supported inputs:
  - PDF      → pypdf text extraction (in memory)
  - Image    → Gemini Vision (in memory, base64)
  - DOCX     → python-docx text extraction (in memory)
  - Plain text → pass through

Flow:
  1. Receive file/text via multipart form
  2. Extract text in memory — zero storage writes
  3. Truncate to MAX_CONTEXT_CHARS to control token cost
  4. Route to Groq (text) or Gemini (images)
  5. Stream response back to frontend

DB writes:
  - One tiny row in study_sessions on session start (title + source_type only)
  - Chat history lives in the browser — never sent to DB

Cost controls:
  - MAX_CONTEXT_CHARS = 12000  (~3000 tokens)
  - Groq llama3 for text (very cheap)
  - Gemini flash for images (cheap vision model)
  - No embeddings, no vector DB, no chunking

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
import re
import uuid
from typing import AsyncGenerator, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth import get_current_user
from app.supabase_client import supabase

router = APIRouter(prefix="/api/study", tags=["study"])

# ── Cost controls ──────────────────────────────────────────────────────────────

MAX_CONTEXT_CHARS = 12_000          # ~3k tokens — fits every model cheaply
MAX_FILE_MB       = 10              # reject files over 10 MB upfront
MAX_FILE_BYTES    = MAX_FILE_MB * 1024 * 1024

GROQ_MODEL        = "llama-3.1-8b-instant"   # fastest + cheapest Groq model
GEMINI_MODEL      = "gemini-1.5-flash"        # cheapest Gemini with vision

# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are SparkL Study AI — a smart, friendly tutor helping Nigerian polytechnic and university students understand their course material.

The student has shared their notes or study material with you. Your job is to help them study effectively.

Rules:
- Be concise and clear — students are on mobile, keep answers focused
- Use simple language; avoid unnecessary jargon
- When generating quiz questions, mix MCQ and theory
- Always relate explanations to Nigerian tertiary education context where relevant
- Never make up facts not in the provided material
- If asked something not covered in the notes, say so honestly"""

# ── Extractors (all in-memory, zero storage) ───────────────────────────────────

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
    """Truncate to MAX_CONTEXT_CHARS. Returns (text, was_truncated)."""
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


# ── Groq streaming (text inputs) ──────────────────────────────────────────────

async def _stream_groq(messages: list[dict]) -> AsyncGenerator[str, None]:
    try:
        from groq import AsyncGroq
    except ImportError:
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
    try:
        import google.generativeai as genai
    except ImportError:
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

    prompt = (
        f"{history_text}\n\nStudent: {user_message}"
        if history_text
        else user_message
    )

    response = await model.generate_content_async(
        [image_part, prompt],
        stream=True,
        generation_config={"max_output_tokens": 1024, "temperature": 0.4},
    )

    async for chunk in response:
        if chunk.text:
            yield chunk.text


# ── Request / Response models ──────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class StudySessionRow(BaseModel):
    id: str
    title: str
    source_type: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/session", response_model=StudySessionRow)
async def create_session(
    title:       str  = Form(...),
    source_type: str  = Form(...),   # pdf | image | docx | text
    user_id:     str  = Depends(get_current_user),
):
    """
    Create a study session row (tiny — just title + source_type).
    Returns session ID used by the frontend to group chat history.
    No file content is stored.
    """
    session_id = str(uuid.uuid4())
    try:
        supabase.table("study_sessions").insert({
            "id":          session_id,
            "user_id":     user_id,
            "title":       title[:120],   # cap title length
            "source_type": source_type,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create session: {e}")

    return StudySessionRow(id=session_id, title=title, source_type=source_type)


@router.post("/chat")
async def study_chat(
    # File inputs (all optional — only one expected per request)
    file:         UploadFile | None = File(None),

    # Text fallback (if no file, or for plain text notes)
    text_content: str | None        = Form(None),

    # Chat
    message:      str               = Form(...),
    history:      str               = Form("[]"),   # JSON array of {role, content}
    mode:         str               = Form("chat"),  # chat | quiz | summary | explain

    user_id: str = Depends(get_current_user),
):
    """
    Main study chat endpoint.

    - File is processed in memory — never written to disk or storage
    - history is sent by the frontend each request (browser owns it)
    - mode changes the system instruction appended to the message
    """
    import json

    # ── 1. Parse history ───────────────────────────────────────────────
    try:
        raw_history: list[dict] = json.loads(history)
        # Cap history at last 6 exchanges to control token cost
        raw_history = raw_history[-12:]
    except Exception:
        raw_history = []

    # ── 2. Mode prefix ─────────────────────────────────────────────────
    mode_prefix = {
        "quiz":    "Generate 5 practice questions (mix MCQ and theory) from the notes below. For MCQ include options A-D and the correct answer.",
        "summary": "Summarise the key points from the notes below in clear bullet points. Group by topic.",
        "explain": "Explain the main concepts from the notes below simply, as if teaching a student seeing this topic for the first time.",
        "chat":    "",
    }.get(mode, "")

    full_message = f"{mode_prefix}\n\n{message}".strip() if mode_prefix else message

    # ── 3. Process file (in memory) ────────────────────────────────────
    context_block  = ""
    is_image       = False
    image_b64      = ""
    image_mime     = ""
    source_label   = "Uploaded notes"

    if file and file.filename:
        # Size check
        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large — max {MAX_FILE_MB} MB.",
            )

        fname     = file.filename.lower()
        mime      = file.content_type or ""
        source_label = file.filename

        if fname.endswith(".pdf") or "pdf" in mime:
            raw_text      = _extract_pdf(file_bytes)
            context_block = _build_context_block(raw_text, source_label)

        elif fname.endswith(".docx") or "wordprocessingml" in mime:
            raw_text      = _extract_docx(file_bytes)
            context_block = _build_context_block(raw_text, source_label)

        elif mime.startswith("image/") or fname.endswith((".jpg", ".jpeg", ".png", ".webp")):
            # Image — will go to Gemini Vision, not Groq
            is_image   = True
            image_b64  = base64.b64encode(file_bytes).decode()
            image_mime = mime or "image/jpeg"

        elif fname.endswith(".txt"):
            raw_text      = file_bytes.decode("utf-8", errors="replace")
            context_block = _build_context_block(raw_text, source_label)

        else:
            raise HTTPException(
                status_code=415,
                detail="Unsupported file type. Use PDF, DOCX, image, or plain text.",
            )

    elif text_content:
        context_block = _build_context_block(text_content, "Pasted text")

    # ── 4. Build messages ──────────────────────────────────────────────

    if is_image:
        # Gemini handles images — build history as plain text string
        history_text = "\n".join(
            f"{'Student' if m['role'] == 'user' else 'SparkL AI'}: {m['content']}"
            for m in raw_history
        )
        return StreamingResponse(
            _stream_gemini_image(image_b64, image_mime, full_message, history_text),
            media_type="text/plain",
        )

    # Text path → Groq
    # Build messages array
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # If we have a context block, inject it as the first user turn
    if context_block:
        messages.append({
            "role":    "user",
            "content": f"Here are my study notes:\n\n{context_block}",
        })
        messages.append({
            "role":    "assistant",
            "content": "Got it! I've read through your notes. What would you like to do — ask questions, get a summary, practice quiz, or have me explain something?",
        })

    # Append chat history
    for m in raw_history:
        if m.get("role") in ("user", "assistant") and m.get("content"):
            messages.append({"role": m["role"], "content": m["content"]})

    # Current message
    messages.append({"role": "user", "content": full_message})

    return StreamingResponse(
        _stream_groq(messages),
        media_type="text/plain",
    )


@router.get("/sessions")
async def list_sessions(user_id: str = Depends(get_current_user)):
    """List the user's study sessions (title + type only — no content)."""
    try:
        res = (
            supabase.table("study_sessions")
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
    """Delete a session row. No files to clean up — nothing was stored."""
    try:
        supabase.table("study_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
