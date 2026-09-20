import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.supabase_client import supabase

router = APIRouter(prefix="/api/payments", tags=["payments"])

PAYVESSEL_SECRET_KEY = os.getenv("PAYVESSEL_SECRET_KEY")
PAYVESSEL_VERIFY_URL = "https://api.payvessel.com/api/service/request/transaction/verify/{reference}"

FREE_PLAN_LIMITS = {
    "max_courses": 3,
    "read_mode_percent": 10,
    "practice_mode_max": 5,
    "can_download": False,
}

PAID_PLAN_LIMITS = {
    "max_courses": None,
    "read_mode_percent": 100,
    "practice_mode_max": None,
    "can_download": True,
}


def _get_plan_limits(plan: str, expires_at: str | None) -> dict:
    if plan == "free" or not expires_at:
        return {"is_paid": False, **FREE_PLAN_LIMITS}

    try:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expiry < datetime.now(expiry.tzinfo):
            return {"is_paid": False, **FREE_PLAN_LIMITS}
    except Exception:
        return {"is_paid": False, **FREE_PLAN_LIMITS}

    return {"is_paid": True, **PAID_PLAN_LIMITS}


# ─── POST /api/payments/initiate ────────────────────────────────────────────

@router.post("/initiate")
async def initiate_payment(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    plan_slug = body.get("plan")
    if not plan_slug or plan_slug == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

    # Fetch plan from DB
    try:
        plan_res = (
            supabase.table("subscription_plans")
            .select("id, plan, display_name, price_kobo, currency, duration_days")
            .eq("plan", plan_slug)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Plan not found")

    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan = plan_res.data
    reference = f"SPARKL-{uuid4().hex[:12].upper()}"

    # Create pending transaction
    supabase.table("payment_transactions").insert({
        "user_id": user_id,
        "plan": plan_slug,
        "gateway": "payvessel",
        "gateway_ref": reference,
        "amount_kobo": plan["price_kobo"],
        "currency": plan["currency"],
        "status": "pending",
    }).execute()

    return {
        "reference": reference,
        "amount": plan["price_kobo"] / 100,
        "amount_kobo": plan["price_kobo"],
        "plan": plan["plan"],
        "display_name": plan["display_name"],
        "currency": plan["currency"],
    }


# ─── POST /api/payments/verify ──────────────────────────────────────────────

@router.post("/verify")
async def verify_payment(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    reference = body.get("reference")
    if not reference:
        raise HTTPException(status_code=400, detail="Reference is required")

    # Fetch transaction
    try:
        txn_res = (
            supabase.table("payment_transactions")
            .select("*")
            .eq("gateway_ref", reference)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not txn_res.data:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn = txn_res.data

    if txn["status"] == "success":
        return {"status": "already_verified", "message": "Subscription already active"}

    # Verify with PayVessel
    try:
        async with httpx.AsyncClient() as client:
            pv_res = await client.get(
                PAYVESSEL_VERIFY_URL.format(reference=reference),
                headers={
                    "Authorization": f"Bearer {PAYVESSEL_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=15.0,
            )
        pv_data = pv_res.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach PayVessel")

    pv_status = pv_data.get("requestSuccessful") or pv_data.get("data", {}).get("status")
    pv_amount = pv_data.get("data", {}).get("amount")

    # Mark failed if PayVessel says so
    if not pv_status or pv_status not in (True, "success", "successful"):
        supabase.table("payment_transactions").update({
            "status": "failed",
            "failed_reason": f"PayVessel status: {pv_status}",
        }).eq("gateway_ref", reference).execute()
        raise HTTPException(status_code=400, detail="Payment not successful")

    # Amount check (PayVessel may return in kobo or naira — adjust if needed)
    if pv_amount and int(pv_amount) != txn["amount_kobo"]:
        supabase.table("payment_transactions").update({
            "status": "failed",
            "failed_reason": "Amount mismatch",
        }).eq("gateway_ref", reference).execute()
        raise HTTPException(status_code=400, detail="Amount mismatch")

    # Fetch plan details
    plan_res = (
        supabase.table("subscription_plans")
        .select("duration_days, display_name")
        .eq("plan", txn["plan"])
        .maybe_single()
        .execute()
    )
    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan = plan_res.data
    now = datetime.utcnow()
    expires_at = now + timedelta(days=plan["duration_days"])
    expires_iso = expires_at.isoformat()

    # Fetch existing active subscription
    existing_sub_res = (
        supabase.table("subscriptions")
        .select("id, expires_at")
        .eq("user_id", user_id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    existing_sub = (existing_sub_res.data or {}) if existing_sub_res else {}

    if existing_sub.get("id"):
        # Extend from current expiry if still active
        try:
            current_expiry = datetime.fromisoformat(
                existing_sub["expires_at"].replace("Z", "+00:00")
            ).replace(tzinfo=None)
            base = max(current_expiry, now)
        except Exception:
            base = now

        expires_at = base + timedelta(days=plan["duration_days"])
        expires_iso = expires_at.isoformat()

        sub_res = supabase.table("subscriptions").update({
            "plan": txn["plan"],
            "status": "active",
            "expires_at": expires_iso,
            "auto_renew": True,
        }).eq("id", existing_sub["id"]).execute()

        subscription_id = existing_sub["id"]
    else:
        sub_res = supabase.table("subscriptions").insert({
            "user_id": user_id,
            "plan": txn["plan"],
            "status": "active",
            "started_at": now.isoformat(),
            "expires_at": expires_iso,
            "auto_renew": True,
        }).execute()

        subscription_id = (sub_res.data or [{}])[0].get("id")

    # Run these three updates concurrently — they're all independent
    def update_transaction():
        supabase.table("payment_transactions").update({
            "status": "success",
            "paid_at": now.isoformat(),
            "subscription_id": subscription_id,
            "gateway_payload": pv_data,
        }).eq("gateway_ref", reference).execute()

    def update_profile():
        supabase.table("profiles").update({
            "subscription_plan": txn["plan"],
            "subscription_expic": expires_iso,
        }).eq("id", user_id).execute()

    with ThreadPoolExecutor(max_workers=2) as pool:
        pool.submit(update_transaction)
        pool.submit(update_profile)

    return {
        "status": "success",
        "plan": txn["plan"],
        "display_name": plan["display_name"],
        "expires_at": expires_iso,
    }


# ─── GET /api/payments/subscription/status ──────────────────────────────────

@router.get("/subscription/status")
async def get_subscription_status(user_id: str = Depends(get_current_user)):
    try:
        profile_res = (
            supabase.table("profiles")
            .select("subscription_plan, subscription_expic")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Profile not found")

    data = profile_res.data or {}
    plan = data.get("subscription_plan") or "free"
    expires_at = data.get("subscription_expic")

    limits = _get_plan_limits(plan, expires_at)

    return {
        "plan": plan if limits["is_paid"] else "free",
        "expires_at": expires_at,
        **limits,
    }