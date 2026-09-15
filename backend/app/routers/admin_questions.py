from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.admin_auth import get_current_admin
from app.supabase_client import supabase
from app.storage import get_signed_url, delete_file
from app.services.question_processor import process_questions, ProcessingError

router = APIRouter(prefix="/api/admin/questions", tags=["admin-questions"])

MAX_EXTRACTED_TEXT_LENGTH = 50_000


class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class ExtractedTextUpdate(BaseModel):
    extracted_text: str


@router.get("")
async def list_questions(
    status: Optional[str] = Query(None),
    admin_id: str = Depends(get_current_admin),
):
    query = (
        supabase.table("past_questions")
        .select(
            "id, title, year, status, created_at, file_url, extracted_text, "
            "rejection_reason, uploaded_by, "
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

    # Fetch which past_question_ids have already been AI processed
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
    res = (
        supabase.table("past_questions")
        .select("id, file_url, status")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    url = get_signed_url(res.data["file_url"], expires_in=300)
    return {"url": url, "expires_in": 300}


@router.patch("/{question_id}/status")
async def update_question_status(
    question_id: str,
    payload: StatusUpdate,
    admin_id: str = Depends(get_current_admin),
):
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


@router.post("/{question_id}/process")
async def process_question_with_ai(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    # 1. Fetch the record
    res = (
        supabase.table("past_questions")
        .select("id, extracted_text, status, course_id, course:courses(name)")
        .eq("id", question_id)
        .maybe_single()
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found.")

    record = res.data

    if record["status"] != "approved":
        raise HTTPException(
            status_code=400,
            detail="Only approved papers can be processed."
        )

    extracted_text = record.get("extracted_text") or ""
    if not extracted_text or extracted_text.startswith("[extraction failed"):
        raise HTTPException(
            status_code=400,
            detail="No valid extracted text to process."
        )

    course_name = (record.get("course") or {}).get("name", "")

    # 2. Send to Gemini
    try:
        questions = process_questions(
            extracted_text=extracted_text,
            course_name=course_name,
        )
    except ProcessingError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not questions:
        raise HTTPException(
            status_code=500,
            detail="Gemini returned no questions. Check extracted text quality."
        )

    # 3. Delete any previously processed questions for this paper (re-run safe)
    supabase.table("questions").delete().eq(
        "past_question_id", question_id
    ).execute()

    # 4. Bulk insert
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
            "ai_processed":     True,
        }
        for q in questions
    ]

    insert_res = supabase.table("questions").insert(rows).execute()

    return {
        "processed": True,
        "questions_created": len(insert_res.data or []),
    }


@router.get("/{question_id}/processed-questions")
async def get_processed_questions(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
    """Preview the AI-processed questions for a paper."""
    res = (
        supabase.table("questions")
        .select(
            "id, question_number, question_text, question_type, "
            "option_a, option_b, option_c, option_d, "
            "correct_answer, model_answer, explanation, topic_tag"
        )
        .eq("past_question_id", question_id)
        .order("question_number")
        .execute()
    )

    return res.data or []


@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    admin_id: str = Depends(get_current_admin),
):
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