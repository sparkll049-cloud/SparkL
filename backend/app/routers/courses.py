# routers/courses.py
from concurrent.futures import ThreadPoolExecutor
import re

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.supabase_client import supabase
from app.services.subscription import get_user_limits

router = APIRouter(prefix="/api/courses", tags=["courses"])


# ── Global course search ───────────────────────────────────────────────────────

@router.get("/search")
async def search_courses(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=30),
    user_id: str = Depends(get_current_user),
):
    raw = q.strip()
    if not raw:
        return {"courses": []}

    seen_ids: set[str] = set()
    courses: list[dict] = []

    def normalize(rows: list[dict]):
        for r in rows:
            if not r or r.get("id") in seen_ids:
                continue
            seen_ids.add(r["id"])
            dept = r.get("department") or {}
            inst = dept.get("institution") or {}
            courses.append({
                "id":          r["id"],
                "name":        r["name"],
                "department":  dept.get("name"),
                "institution": inst.get("name"),
            })

    def fetch_by_name():
        return (
            supabase.table("courses")
            .select(
                "id, name, "
                "department:departments(name, institution:institutions(name))"
            )
            .ilike("name", f"%{raw}%")
            .order("name")
            .limit(limit)
            .execute()
        )

    def fetch_departments():
        return (
            supabase.table("departments")
            .select("id, name, institution:institutions(name)")
            .ilike("name", f"%{raw}%")
            .limit(15)
            .execute()
        )

    def fetch_institutions():
        return (
            supabase.table("institutions")
            .select("id, name")
            .ilike("name", f"%{raw}%")
            .limit(10)
            .execute()
        )

    def fetch_via_junction():
        return (
            supabase.table("course_departments")
            .select(
                "courses(id, name, "
                "  department:departments(name, institution:institutions(name))"
                ")"
            )
            .limit(limit * 3)
            .execute()
        )

    with ThreadPoolExecutor(max_workers=4) as pool:
        name_future     = pool.submit(fetch_by_name)
        dept_future     = pool.submit(fetch_departments)
        inst_future     = pool.submit(fetch_institutions)
        junction_future = pool.submit(fetch_via_junction)

        name_res     = name_future.result()
        dept_res     = dept_future.result()
        inst_res     = inst_future.result()
        junction_res = junction_future.result()

    normalize(name_res.data or [])

    # Course code variant (e.g. MTH201 → MTH 201)
    code_like = re.match(r'^([a-zA-Z]+)(\d+.*)$', raw)
    if code_like and len(courses) < limit:
        spaced = f"{code_like.group(1)} {code_like.group(2)}"
        res2 = (
            supabase.table("courses")
            .select(
                "id, name, "
                "department:departments(name, institution:institutions(name))"
            )
            .ilike("name", f"%{spaced}%")
            .order("name")
            .limit(limit)
            .execute()
        )
        normalize(res2.data or [])

    # Junction courses filtered by search term
    for row in (junction_res.data or []):
        c = row.get("courses")
        if c and raw.lower() in c.get("name", "").lower():
            normalize([c])

    dept_ids: list[str] = [d["id"] for d in (dept_res.data or [])]

    inst_ids = [i["id"] for i in (inst_res.data or [])]
    if inst_ids:
        depts_from_inst = (
            supabase.table("departments")
            .select("id")
            .in_("institution_id", inst_ids)
            .execute()
        )
        dept_ids += [d["id"] for d in (depts_from_inst.data or [])]

    if dept_ids and len(courses) < limit:
        dept_courses_res = (
            supabase.table("courses")
            .select(
                "id, name, "
                "department:departments(name, institution:institutions(name))"
            )
            .in_("department_id", list(set(dept_ids)))
            .order("name")
            .limit(limit)
            .execute()
        )
        normalize(dept_courses_res.data or [])

    return {"courses": courses[:limit]}


# ── List courses (enrolled) ────────────────────────────────────────────────────

@router.get("")
async def list_courses(user_id: str = Depends(get_current_user)):
    """
    Returns ALL courses the user enrolled in via user_courses,
    regardless of department. Falls back to department courses if
    user_courses is empty.
    """

    # ── Step 1: check user_courses ────────────────────────────────────────────
    uc_res = (
        supabase.table("user_courses")
        .select("course_id")
        .eq("user_id", user_id)
        .execute()
    )
    selected_ids = [row["course_id"] for row in (uc_res.data or [])]

    if selected_ids:
        def get_courses():
            return (
                supabase.table("courses")
                .select("id, name")
                .in_("id", selected_ids)
                .order("name")
                .execute()
            )

        def get_question_counts():
            return (
                supabase.table("past_questions")
                .select("course_id")
                .in_("course_id", selected_ids)
                .eq("status", "approved")
                .execute()
            )

        def get_limits():
            return get_user_limits(user_id)

        def get_profile():
            return (
                supabase.table("profiles")
                .select("department_id")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )

        with ThreadPoolExecutor(max_workers=4) as pool:
            courses_future = pool.submit(get_courses)
            pq_future      = pool.submit(get_question_counts)
            limits_future  = pool.submit(get_limits)
            profile_future = pool.submit(get_profile)

            courses_res = courses_future.result()
            pq_res      = pq_future.result()
            limits      = limits_future.result()
            profile_res = profile_future.result()

        courses       = courses_res.data or []
        department_id = (profile_res.data or {}).get("department_id")

        counts: dict[str, int] = {}
        for row in (pq_res.data or []):
            counts[row["course_id"]] = counts.get(row["course_id"], 0) + 1

        result = [
            {
                "id":             c["id"],
                "name":           c["name"],
                "code":           None,
                "question_count": counts.get(c["id"], 0),
                "selected":       True,
            }
            for c in courses
        ]

        if not limits["is_paid"]:
            unlocked = result[:3]
            locked = [
                {
                    "id":             c["id"],
                    "name":           c["name"],
                    "code":           None,
                    "locked":         True,
                    "question_count": None,
                    "selected":       True,
                }
                for c in result[3:]
            ]
        else:
            unlocked = result
            locked   = []

        return {
            "courses":        unlocked,
            "locked_courses": locked,
            "department_id":  department_id,
            "is_paid":        limits["is_paid"],
            "plan":           "free" if not limits["is_paid"] else "paid",
        }

    # ── Step 2: fallback — load from department + junction ────────────────────
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
        return {
            "courses":        [],
            "locked_courses": [],
            "department_id":  None,
            "is_paid":        True,
            "plan":           "free",
        }

    def get_direct_courses():
        return (
            supabase.table("courses")
            .select("id, name")
            .eq("department_id", department_id)
            .order("name")
            .execute()
        )

    def get_junction_courses():
        return (
            supabase.table("course_departments")
            .select("courses(id, name)")
            .eq("department_id", department_id)
            .execute()
        )

    def get_limits():
        return get_user_limits(user_id)

    with ThreadPoolExecutor(max_workers=3) as pool:
        direct_future  = pool.submit(get_direct_courses)
        junction_future = pool.submit(get_junction_courses)
        limits_future  = pool.submit(get_limits)

        direct_res  = direct_future.result()
        junction_res = junction_future.result()
        limits      = limits_future.result()

    seen: set[str] = set()
    all_courses: list[dict] = []
    for c in (direct_res.data or []):
        if c["id"] not in seen:
            seen.add(c["id"])
            all_courses.append(c)
    for row in (junction_res.data or []):
        c = row.get("courses")
        if c and c["id"] not in seen:
            seen.add(c["id"])
            all_courses.append({"id": c["id"], "name": c["name"]})

    all_courses.sort(key=lambda x: x["name"])

    def get_question_counts():
        ids = [c["id"] for c in all_courses]
        if not ids:
            return None
        return (
            supabase.table("past_questions")
            .select("course_id")
            .in_("course_id", ids)
            .eq("status", "approved")
            .execute()
        )

    pq_res = get_question_counts()
    counts: dict[str, int] = {}
    for row in ((pq_res.data if pq_res else None) or []):
        counts[row["course_id"]] = counts.get(row["course_id"], 0) + 1

    result = [
        {
            "id":             c["id"],
            "name":           c["name"],
            "code":           None,
            "question_count": counts.get(c["id"], 0),
            "selected":       False,
        }
        for c in all_courses
    ]

    if not limits["is_paid"]:
        unlocked = result[:3]
        locked = [
            {
                "id":             c["id"],
                "name":           c["name"],
                "code":           None,
                "locked":         True,
                "question_count": None,
                "selected":       False,
            }
            for c in result[3:]
        ]
    else:
        unlocked = result
        locked   = []

    return {
        "courses":        unlocked,
        "locked_courses": locked,
        "department_id":  department_id,
        "is_paid":        limits["is_paid"],
        "plan":           "free" if not limits["is_paid"] else "paid",
    }


# ── Course detail ──────────────────────────────────────────────────────────────

@router.get("/{course_id}")
async def get_course_detail(
    course_id: str,
    user_id: str = Depends(get_current_user),
):
    limits = get_user_limits(user_id)

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
            .select("id, title, year, extracted_text, semester_id, created_at")
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
        count_future     = pool.submit(get_count)
        questions_future = pool.submit(get_questions)
        selected_future  = pool.submit(get_selected)

        count_res     = count_future.result()
        questions_res = questions_future.result()
        uc_res        = selected_future.result()

    question_count = count_res.count or 0
    questions      = questions_res.data or []
    is_selected    = len(uc_res.data or []) > 0

    return {
        "course":         course,
        "question_count": question_count,
        "questions":      questions,
        "is_selected":    is_selected,
        "is_paid":        limits["is_paid"],
        "plan":           "free" if not limits["is_paid"] else "paid",
    }


# ── Course questions ───────────────────────────────────────────────────────────

@router.get("/{course_id}/questions")
async def get_course_questions(
    course_id: str,
    mode: str = "read",
    user_id: str = Depends(get_current_user),
):
    limits = get_user_limits(user_id)

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

    questions_res = (
        supabase.table("past_questions")
        .select("id, title, year, extracted_text, semester_id, created_at")
        .eq("course_id", course_id)
        .eq("status", "approved")
        .order("created_at", desc=True)
        .execute()
    )
    all_questions = questions_res.data or []
    total         = len(all_questions)

    if not limits["is_paid"]:
        if mode == "practice":
            questions = all_questions[: limits["practice_mode_max"]]
        else:
            limit_n   = max(1, int(total * (limits["read_mode_percent"] / 100)))
            questions = all_questions[:limit_n]
        is_limited = True
    else:
        questions  = all_questions
        is_limited = False

    return {
        "questions":  questions,
        "showing":    len(questions),
        "total":      total,
        "is_limited": is_limited,
        "mode":       mode,
        "is_paid":    limits["is_paid"],
        "plan":       "free" if not limits["is_paid"] else "paid",
    }