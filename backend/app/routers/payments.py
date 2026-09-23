import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.supabase_client import supabase
from app.services.subscription import get_plan_limits

router = APIRouter(prefix="/api/payments", tags=["payments"])

PAYVESSEL_SECRET_KEY = os.getenv("PAYVESSEL_SECRET_KEY")
PAYVESSEL_VERIFY_URL = "https://api.payvessel.com/api/service/request/transaction/verify"
ADMIN_SECRET = os.getenv("ADMIN_SECRET")  # set this in Render env vars


# ─── POST /api/payments/initiate ────────────────────────────────────────────

@router.post("/initiate")
async def initiate_payment(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    plan_slug = body.get("plan")
    if not plan_slug or plan_slug == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

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

    # ── Call Payvessel to verify ─────────────────────────────────────────────
    pv_res = None
    try:
        async with httpx.AsyncClient() as client:
            pv_res = await client.post(
                PAYVESSEL_VERIFY_URL,
                headers={
                    "api-key": PAYVESSEL_SECRET_KEY,
                    "Content-Type": "application/json",
                },
                json={"transactionRef": reference},
                timeout=15.0,
            )
        print(f"[PayVessel raw] status={pv_res.status_code} body={pv_res.text}")

        if pv_res.status_code == 503:
            raise HTTPException(
                status_code=503,
                detail="Payment gateway is temporarily unavailable. Your payment was received — please contact support to activate your subscription."
            )

        pv_data = pv_res.json()
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PayVessel error] {str(e)}")
        print(f"[PayVessel body] {pv_res.text if pv_res else 'NO RESPONSE - connection failed'}")
        raise HTTPException(status_code=502, detail=f"Could not reach PayVessel: {str(e)}")

    pv_status = (
        pv_data.get("requestSuccessful")
        or pv_data.get("data", {}).get("status")
        or pv_data.get("status")
    )
    pv_amount = (
        pv_data.get("data", {}).get("amount")
        or pv_data.get("amount")
    )

    if not pv_status or pv_status not in (True, "success", "successful"):
        supabase.table("payment_transactions").update({
            "status": "failed",
            "failed_reason": f"PayVessel status: {pv_status}",
        }).eq("gateway_ref", reference).execute()
        raise HTTPException(status_code=400, detail=f"Payment not successful: {pv_status}")

    if pv_amount and int(pv_amount) != txn["amount_kobo"]:
        supabase.table("payment_transactions").update({
            "status": "failed",
            "failed_reason": "Amount mismatch",
        }).eq("gateway_ref", reference).execute()
        raise HTTPException(status_code=400, detail="Amount mismatch")

    return await _activate_subscription(user_id, txn["plan"], pv_data=pv_data, reference=reference)


# ─── POST /api/payments/admin/grant ─────────────────────────────────────────
# Admin manually grants a subscription to a user
# Protected by ADMIN_SECRET env var

@router.post("/admin/grant")
async def admin_grant_subscription(body: dict):
    # Verify admin secret
    secret = body.get("secret")
    if not secret or secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    target_user_id = body.get("user_id")
    plan_slug = body.get("plan")
    note = body.get("note", "Manual grant by admin")

    if not target_user_id or not plan_slug:
        raise HTTPException(status_code=400, detail="user_id and plan are required")

    if plan_slug == "free":
        raise HTTPException(status_code=400, detail="Cannot manually grant free plan")

    # Verify plan exists
    plan_res = (
        supabase.table("subscription_plans")
        .select("plan, display_name, duration_days")
        .eq("plan", plan_slug)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Create a manual transaction record
    reference = f"MANUAL-{uuid4().hex[:12].upper()}"
    supabase.table("payment_transactions").insert({
        "user_id": target_user_id,
        "plan": plan_slug,
        "gateway": "payvessel",
        "gateway_ref": reference,
        "amount_kobo": 0,
        "currency": "NGN",
        "status": "pending",
    }).execute()

    result = await _activate_subscription(
        target_user_id,
        plan_slug,
        pv_data={"manual_grant": True, "note": note},
        reference=reference,
    )

    print(f"[Admin grant] user={target_user_id} plan={plan_slug} note={note}")
    return {**result, "note": note}


# ─── Shared subscription activation logic ───────────────────────────────────

async def _activate_subscription(
    user_id: str,
    plan_slug: str,
    pv_data: dict,
    reference: str,
) -> dict:
    plan_res = (
        supabase.table("subscription_plans")
        .select("duration_days, display_name")
        .eq("plan", plan_slug)
        .maybe_single()
        .execute()
    )
    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan = plan_res.data
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=plan["duration_days"])
    expires_iso = expires_at.isoformat()

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
        try:
            current_expiry = datetime.fromisoformat(
                existing_sub["expires_at"].replace("Z", "+00:00")
            )
            if current_expiry.tzinfo is None:
                current_expiry = current_expiry.replace(tzinfo=timezone.utc)
            base = max(current_expiry, now)
        except Exception:
            base = now

        expires_at = base + timedelta(days=plan["duration_days"])
        expires_iso = expires_at.isoformat()

        supabase.table("subscriptions").update({
            "plan": plan_slug,
            "status": "active",
            "expires_at": expires_iso,
            "auto_renew": True,
        }).eq("id", existing_sub["id"]).execute()

        subscription_id = existing_sub["id"]
    else:
        sub_res = supabase.table("subscriptions").insert({
            "user_id": user_id,
            "plan": plan_slug,
            "status": "active",
            "started_at": now.isoformat(),
            "expires_at": expires_iso,
            "auto_renew": True,
        }).execute()

        subscription_id = (sub_res.data or [{}])[0].get("id")

    def update_transaction():
        supabase.table("payment_transactions").update({
            "status": "success",
            "paid_at": now.isoformat(),
            "subscription_id": subscription_id,
            "gateway_payload": pv_data,
        }).eq("gateway_ref", reference).execute()

    def update_profile():
        supabase.table("profiles").update({
            "subscription_plan": plan_slug,
            "subscription_expic": expires_iso,
        }).eq("id", user_id).execute()

    with ThreadPoolExecutor(max_workers=2) as pool:
        pool.submit(update_transaction)
        pool.submit(update_profile)

    return {
        "status": "success",
        "plan": plan_slug,
        "display_name": plan["display_name"],
        "expires_at": expires_iso,
    }


# ─── GET /api/payments/subscription/status ──────────────────────────────────

@router.get("/subscription/status")
async def get_subscription_status(user_id: str = Depends(get_current_user)):
    try:
        profile_res = (
            supabase.table("profiles")
            .select("subscription_plan, subscription_expic, created_at")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Profile not found")

    data = profile_res.data or {}
    plan = data.get("subscription_plan") or "free"
    expires_at = data.get("subscription_expic")
    created_at = data.get("created_at")

    limits = get_plan_limits(plan, expires_at, created_at)

    return {
        "plan": "trial" if limits.get("is_trial") else (
            plan if limits["is_paid"] else "free"
        ),
        "expires_at": expires_at,
        **limits,
    }