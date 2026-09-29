from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.admin_auth import get_current_admin
from app.supabase_client import supabase
from app.storage import get_signed_url, delete_file
from app.services.question_processor import process_questions, ProcessingError

router = APIRouter(prefix="/api/admin/questions", tags=["admin-questions"])

MAX_EXTRACTED_TEXT_LENGTH = 50_000

ITEM_COLUMNS = (
    "id, question_number, question_text, question_type, "
    "option_a, option_b, option_c, option_d, "
    "correct_answer, model_answer, explanation, topic_tag, "
    "difficulty, marks, is_verified, edited_by_admin"
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class ExtractedTextUpdate(BaseModel):
    extracted_text: str


class QuestionItemUpdate(BaseModel):
    question_text:  Optional[str] = Field(None, max_length=5000)
    question_type:  Optional[Literal["mcq", "theory"]] = None
    option_a:       Optional[str] = Field(None, max_length=1000)
    option_b:       Optional[str] = Field(None, max_length=1000)
    option_c:       Optional[str] = Field(None, max_length=1000)
    option_d:       Optional[str] = Field(None, max_length=1000)
    correct_answer: Optional[Literal["a", "b", "c", "d"]] = None
    model_answer:   Optional[str] = Field(None, max_length=10000)
    explanation:    Optional[str] = Field(None, max_length=5000)
    topic_tag:      Optional[str] = Field(None, max_length=100)
    difficulty:     Optional[Literal["easy", "medium", "hard"]] = None
    marks:          Optional[int] = Field(None, ge=0, le=1000)
    is_verified:    Optional[bool] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _check_uuid(value: str, label: str = "id") -> None:
    try:
        UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")


def _first(res) -> Optional[dict]:
    rows = res.data if res else None
    return rows[0] if rows else None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Paper list / status / text ───────────────────────────────────────────────

@router.get("")
async def list_questions(
    status: Optional[str] = Query(None),
    admin_id: str = Depends(get_current_admin),
):
    query = (
        supabase.table("past_questions")
        .select(
            "id, title, year, status, processing_status, created_at, file_url, "
            "extracted_text, extraction_quality, rejection_reason, uploaded_by, "
            "course:courses(name), "
            "semester:semesters(name)"
        )
        .order("created_at", desc=True)
    )

    if status:
        query = query.eq("status", status)

    res = query.execute()
    questions = res.data or []

    uploader_ids = list({q["uploaded_by"] for q in questions if q.get("uploaded_by")})

    profiles_by_id = {}
    if uploader_ids:
        profiles_res = (
            supabase.table("profiles")
            .select("id, full_name")
            .in_("id", uploader_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (profiles_res.data or [])}

    # Which papers already have generated questions
    question_ids = [q["id"] for q in questions]
    processed_ids: set[str] = set()
    if question_ids:
        proc_res = (
            supabase.table("questions")
            .select("past_question_id")
            .in_("past_question_id", question_ids)
            .execute()
        )
        processed_ids = {r["past_question_id"] for r in (proc_res.data or [])}

    for q in questions:
        profile = profiles_by_id.get(q.get("uploaded_by"))
        q["uploader"] = {"full_name": profile["full_name"]} if profile else None
        q.pop("uploaded_by", None)
        q["ai_processed"] = q["id"] in processed_ids

    return questions


@router.get("/{question_id}/file-url")
async def get_question_file_url(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")

    res = (
        supabase.table("past_questions")
        .select("id, file_url, status")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )
    row = _first(res)
    if not row:
        raise HTTPException(status_code=404, detail="Question not found.")

    url = get_signed_url(row["file_url"], expires_in=300)
    return {"url": url, "expires_in": 300}


@router.patch("/{question_id}/status")
async def update_question_status(
    question_id: str,
    payload: StatusUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")

    if payload.status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid status.")

    if payload.status == "rejected" and not payload.reason:
        raise HTTPException(
            status_code=400, detail="A reason is required when rejecting."
        )

    update_data: dict = {"status": payload.status}

    if payload.status == "rejected":
        update_data["rejection_reason"] = payload.reason
    else:
        update_data["rejection_reason"] = None

    res = (
        supabase.table("past_questions")
        .update(update_data)
        .eq("id", question_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    return res.data[0]


@router.patch("/{question_id}/text")
async def update_extracted_text(
    question_id: str,
    payload: ExtractedTextUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")

    text = payload.extracted_text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Extracted text cannot be empty.")
    if len(text) > MAX_EXTRACTED_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Extracted text must be under {MAX_EXTRACTED_TEXT_LENGTH} characters.",
        )

    res = (
        supabase.table("past_questions")
        .update({"extracted_text": text, "extraction_quality": 1.0})
        .eq("id", question_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    return res.data[0]


# ── AI (re)generation ────────────────────────────────────────────────────────

@router.post("/{question_id}/process")
async def process_question_with_ai(
    question_id: str,
    force: bool = Query(False, description="Overwrite questions an admin already edited or verified."),
    admin_id: str = Depends(get_current_admin),
):
    """
    (Re)generate the AI draft questions for a paper. Works on pending papers too,
    because review happens BEFORE approval. Refuses to wipe reviewed work unless
    force=true.
    """
    _check_uuid(question_id, "question id")

    res = (
        supabase.table("past_questions")
        .select("id, extracted_text, status, course_id, course:courses(name)")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )
    record = _first(res)
    if not record:
        raise HTTPException(status_code=404, detail="Question not found.")

    if record["status"] == "rejected":
        raise HTTPException(status_code=400, detail="Rejected papers can't be processed.")

    extracted_text = record.get("extracted_text") or ""
    if not extracted_text or extracted_text.startswith("[extraction failed"):
        raise HTTPException(status_code=400, detail="No valid extracted text to process.")

    if not force:
        reviewed = (
            supabase.table("questions")
            .select("id")
            .eq("past_question_id", question_id)
            .or_("is_verified.eq.true,edited_by_admin.eq.true")
            .limit(1)
            .execute()
        )
        if reviewed.data:
            raise HTTPException(
                status_code=409,
                detail="This paper has reviewed questions. Regenerating will erase your edits.",
            )

    course_name = (record.get("course") or {}).get("name", "")

    # The LLM call can take a while — run it off the event loop
    try:
        questions = await run_in_threadpool(
            process_questions, extracted_text, course_name
        )
    except ProcessingError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not questions:
        raise HTTPException(
            status_code=500,
            detail="The AI returned no questions. Check extracted text quality.",
        )

    supabase.table("questions").delete().eq("past_question_id", question_id).execute()

    rows = [
        {
            "past_question_id": question_id,
            "course_id":        record["course_id"],
            "question_number":  q.get("question_number"),
            "question_text":    q.get("question_text", ""),
            "question_type":    q.get("question_type", "theory"),
            "option_a":         q.get("option_a"),
            "option_b":         q.get("option_b"),
            "option_c":         q.get("option_c"),
            "option_d":         q.get("option_d"),
            "correct_answer":   q.get("correct_answer"),
            "model_answer":     q.get("model_answer"),
            "explanation":      q.get("explanation"),
            "topic_tag":        q.get("topic_tag"),
            "difficulty":       q.get("difficulty"),
            "marks":            q.get("marks"),
            "ai_processed":     True,
            "is_verified":      False,
            "edited_by_admin":  False,
        }
        for q in questions
    ]

    insert_res = supabase.table("questions").insert(rows).execute()

    supabase.table("past_questions").update(
        {"processing_status": "ready", "processing_error": None}
    ).eq("id", question_id).execute()

    return {
        "processed": True,
        "questions_created": len(insert_res.data or []),
    }


# ── Review: list / edit / delete / verify ────────────────────────────────────

@router.get("/{question_id}/processed-questions")
async def get_processed_questions(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    """Draft questions for a paper, for the admin review panel."""
    _check_uuid(question_id, "question id")

    res = (
        supabase.table("questions")
        .select(ITEM_COLUMNS)
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )
    return res.data or []


@router.patch("/{question_id}/items/{item_id}")
async def update_question_item(
    question_id: str,
    item_id: str,
    payload: QuestionItemUpdate,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    _check_uuid(item_id, "item id")

    existing = _first(
        supabase.table("questions")
        .select(ITEM_COLUMNS)
        .eq("id", item_id)
        .eq("past_question_id", question_id)
        .limit(1)
        .execute()
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found.")

    data = payload.model_dump(exclude_unset=True)
    verified = data.pop("is_verified", None)

    if "question_text" in data and not (data["question_text"] or "").strip():
        raise HTTPException(status_code=400, detail="Question text can't be empty.")

    merged = {**existing, **data}

    if merged["question_type"] == "mcq":
        filled = {k for k in "abcd" if (merged.get(f"option_{k}") or "").strip()}
        if len(filled) < 2:
            raise HTTPException(status_code=400, detail="An MCQ needs at least two options.")
        if merged.get("correct_answer") not in filled:
            raise HTTPException(
                status_code=400, detail="Choose a correct answer that matches an option."
            )
    else:
        # Theory questions carry no options or letter answer
        for col in ("option_a", "option_b", "option_c", "option_d", "correct_answer"):
            data[col] = None

    content_changed = bool(data)
    if content_changed:
        data["edited_by_admin"] = True
        # Edited content must be re-verified unless the admin verifies in the same save
        if verified is None:
            verified = False

    if verified is True:
        data.update({"is_verified": True, "verified_by": admin_id, "verified_at": _now_iso()})
    elif verified is False:
        data.update({"is_verified": False, "verified_by": None, "verified_at": None})

    if not data:
        return existing

    res = (
        supabase.table("questions")
        .update(data)
        .eq("id", item_id)
        .eq("past_question_id", question_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    return {k: res.data[0].get(k) for k in ITEM_COLUMNS.replace(" ", "").split(",")}


@router.delete("/{question_id}/items/{item_id}")
async def delete_question_item(
    question_id: str,
    item_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")
    _check_uuid(item_id, "item id")

    res = (
        supabase.table("questions")
        .delete()
        .eq("id", item_id)
        .eq("past_question_id", question_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")
    return {"deleted": True}


@router.post("/{question_id}/verify-all")
async def verify_all_items(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")

    res = (
        supabase.table("questions")
        .update({"is_verified": True, "verified_by": admin_id, "verified_at": _now_iso()})
        .eq("past_question_id", question_id)
        .execute()
    )
    return {"verified": len(res.data or [])}


# ── Delete whole paper ───────────────────────────────────────────────────────

@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    _check_uuid(question_id, "question id")

    existing = (
        supabase.table("past_questions")
        .select("id, file_url")
        .eq("id", question_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    file_url = existing.data[0].get("file_url")

    res = supabase.table("past_questions").delete().eq("id", question_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    if file_url:
        delete_file(file_url)

    return {"deleted": True}
