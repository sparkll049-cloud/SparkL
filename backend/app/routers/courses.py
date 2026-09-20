from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.supabase_client import supabase
from app.services.subscription import get_user_limits

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("")
async def list_courses(user_id: str = Depends(get_current_user)):
    try:
        profile_res = (
            supabase.table("profiles")
            .select("department_id")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Profile not found")

    department_id = (profile_res.data or {}).get("department_id")

    if not department_id:
        return {"courses": [], "department_id": None}

    courses_res = (
        supabase.table("courses")
        .select("id, name")
        .eq("department_id", department_id)
        .order("name")
        .execute()
    )
    courses = courses_res.data or []
    course_ids = [c["id"] for c in courses]

    def get_question_counts():
        if not course_ids:
            return []
        return (
            supabase.table("past_questions")
            .select("course_id")
            .in_("course_id", course_ids)
            .eq("status", "approved")
            .execute()
        )

    def get_selected():
        return (
            supabase.table("user_courses")
            .select("course_id")
            .eq("user_id", user_id)
            .execute()
        )

    def get_limits():
        return get_user_limits(user_id)

    # All three are independent — run concurrently
    with ThreadPoolExecutor(max_workers=3) as pool:
        pq_future = pool.submit(get_question_counts)
        uc_future = pool.submit(get_selected)
        limits_future = pool.submit(get_limits)

        pq_res = pq_future.result()
        uc_res = uc_future.result()
        limits = limits_future.result()

    counts: dict[str, int] = {}
    if pq_res:
        for row in pq_res.data or []:
            counts[row["course_id"]] = counts.get(row["course_id"], 0) + 1

    selected_ids = {row["course_id"] for row in (uc_res.data or [])}

    result = [
        {
            "id": c["id"],
            "name": c["name"],
            "question_count": counts.get(c["id"], 0),
            "selected": c["id"] in selected_ids,
        }
        for c in courses
    ]

    # Apply free tier course cap
    if not limits["is_paid"]:
        unlocked = result[:3]
        locked = [
            {
                "id": c["id"],
                "name": c["name"],
                "locked": True,
                "question_count": None,
                "selected": c["id"] in selected_ids,
            }
            for c in result[3:]
        ]
    else:
        unlocked = result
        locked = []

    return {
        "courses": unlocked,
        "locked_courses": locked,
        "department_id": department_id,
        "is_paid": limits["is_paid"],
        "plan": "free" if not limits["is_paid"] else "paid",
    }


@router.get("/{course_id}")
async def get_course_detail(
    course_id: str,
    user_id: str = Depends(get_current_user),
):
    # Get limits first — needed to gate access
    limits = get_user_limits(user_id)

    # Free tier: check if this course is within their allowed 3
    if not limits["is_paid"]:
        uc_check = (
            supabase.table("user_courses")
            .select("course_id")
            .eq("user_id", user_id)
            .execute()
        )
        all_user_courses = [r["course_id"] for r in (uc_check.data or [])]
        allowed = all_user_courses[:3]

        if course_id not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Upgrade your plan to access this course",
            )

    try:
        course_res = (
            supabase.table("courses")
            .select("id, name, department:departments(id, name)")
            .eq("id", course_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Course not found")

    if not course_res.data:
        raise HTTPException(status_code=404, detail="Course not found")

    course = course_res.data

    def get_count():
        return (
            supabase.table("past_questions")
            .select("id", count="exact")
            .eq("course_id", course_id)
            .eq("status", "approved")
            .execute()
        )

    def get_questions():
        return (
            supabase.table("past_questions")
            .select("id, title, year, created_at")
            .eq("course_id", course_id)
            .eq("status", "approved")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )

    def get_selected():
        return (
            supabase.table("user_courses")
            .select("course_id")
            .eq("user_id", user_id)
            .eq("course_id", course_id)
            .execute()
        )

    with ThreadPoolExecutor(max_workers=3) as pool:
        count_future = pool.submit(get_count)
        questions_future = pool.submit(get_questions)
        selected_future = pool.submit(get_selected)

        count_res = count_future.result()
        questions_res = questions_future.result()
        uc_res = selected_future.result()

    question_count = count_res.count or 0
    questions = questions_res.data or []
    is_selected = len(uc_res.data or []) > 0

    return {
        "course": course,
        "question_count": question_count,
        "questions": questions,
        "is_selected": is_selected,
        "is_paid": limits["is_paid"],
        "plan": "free" if not limits["is_paid"] else "paid",
    }


@router.get("/{course_id}/questions")
async def get_course_questions(
    course_id: str,
    mode: str = "read",
    user_id: str = Depends(get_current_user),
):
    limits = get_user_limits(user_id)

    # Free tier: check course access
    if not limits["is_paid"]:
        uc_res = (
            supabase.table("user_courses")
            .select("course_id")
            .eq("user_id", user_id)
            .execute()
        )
        allowed = [r["course_id"] for r in (uc_res.data or [])][:3]
        if course_id not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Upgrade your plan to access this course",
            )

    # Fetch all approved questions for this course
    questions_res = (
        supabase.table("past_questions")
        .select("id, title, year, extracted_text, semester_id, created_at")
        .eq("course_id", course_id)
        .eq("status", "approved")
        .order("created_at", desc=True)
        .execute()
    )
    all_questions = questions_res.data or []
    total = len(all_questions)

    if not limits["is_paid"]:
        if mode == "practice":
            # Max 5 questions
            questions = all_questions[:limits["practice_mode_max"]]
        else:
            # Read mode: show 10%
            limit = max(1, int(total * (limits["read_mode_percent"] / 100)))
            questions = all_questions[:limit]
        is_limited = True
    else:
        questions = all_questions
        is_limited = False

    return {
        "questions": questions,
        "showing": len(questions),
        "total": total,
        "is_limited": is_limited,
        "mode": mode,
        "is_paid": limits["is_paid"],
        "plan": "free" if not limits["is_paid"] else "paid",
    }