# app/routers/payments.py

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.auth import get_current_user
from app.admin_auth import get_current_admin
from app.supabase_client import supabase
from app.services.subscription import get_plan_limits

router = APIRouter(prefix="/api/payments", tags=["payments"])

PAYVESSEL_SECRET_KEY = os.getenv("PAYVESSEL_SECRET_KEY")
PAYVESSEL_BASE_URL = "https://api.payvessel.com"
PAYVESSEL_VERIFY_URL = f"{PAYVESSEL_BASE_URL}/api/externals/transactions/verify/{{reference}}"
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "")

SERVICE_FEE_KOBO = 10_000  # ₦100 × 100


# ─── POST /api/payments/initiate ────────────────────────────────────────────

@router.post("/initiate")
async def initiate_payment(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    plan_slug = body.get("plan")
    if not plan_slug or plan_slug == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

    total_amount_naira = body.get("total_amount")

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

    if total_amount_naira is not None:
        try:
            amount_kobo = int(float(total_amount_naira) * 100)
        except (ValueError, TypeError):
            amount_kobo = plan["price_kobo"] + SERVICE_FEE_KOBO
    else:
        amount_kobo = plan["price_kobo"] + SERVICE_FEE_KOBO

    reference = f"SPARKL-{uuid4().hex[:12].upper()}"

    # Get user email for PayVessel
    try:
        profile_res = (
            supabase.table("profiles")
            .select("email")
            .eq("id", user_id)
            .single()
            .execute()
        )
        user_email = profile_res.data.get("email", "")
    except Exception:
        user_email = ""

    # Store pending transaction BEFORE calling PayVessel
    supabase.table("payment_transactions").insert({
        "user_id":     user_id,
        "plan":        plan_slug,
        "gateway":     "payvessel",
        "gateway_ref": reference,
        "amount_kobo": amount_kobo,
        "currency":    plan["currency"],
        "status":      "pending",
    }).execute()

    # Call PayVessel initialize — server-side with secret key
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{PAYVESSEL_BASE_URL}/api/transact/initializePayment",
            headers={
                "Authorization": f"Bearer {PAYVESSEL_SECRET_KEY}",
                "Content-Type":  "application/json",
            },
            json={
                "amount":       str(amount_kobo / 100),
                "currency":     plan["currency"],
                "email":        user_email,
                "reference":    reference,
                "callback_url": f"{os.getenv('APP_URL')}/api/payments/callback",
                "metadata": {
                    "plan":      plan_slug,
                    "user_id":   user_id,
                    "reference": reference,
                },
            },
        )

    if resp.status_code != 200:
        # Clean up so user can retry
        supabase.table("payment_transactions").delete()\
            .eq("gateway_ref", reference).execute()
        detail = resp.json().get("message", "PayVessel error")
        raise HTTPException(status_code=502, detail=detail)

    pv_json = resp.json()
    authorization_url = (
        pv_json.get("data", {}).get("authorization_url")
        or pv_json.get("authorization_url")
    )

    if not authorization_url:
        supabase.table("payment_transactions").delete()\
            .eq("gateway_ref", reference).execute()
        raise HTTPException(status_code=502, detail="No authorization_url in PayVessel response")

    return {
        "reference":         reference,
        "authorization_url": authorization_url,
    }


# ─── GET /api/payments/callback ─────────────────────────────────────────────

@router.get("/callback")
async def payment_callback(request: Request):
    """
    PayVessel redirects the user's browser here after payment.
    Verify server-side, activate subscription, redirect to frontend.
    """
    reference = (
        request.query_params.get("reference")
        or request.query_params.get("trxref")
    )
    app_url = os.getenv("APP_URL", "https://sparkl.com.ng")

    if not reference:
        return RedirectResponse(
            f"{app_url}/dashboard/subscribe?error=missing_reference",
            status_code=302,
        )

    # Already verified? Just redirect success
    txn_res = (
        supabase.table("payment_transactions")
        .select("*")
        .eq("gateway_ref", reference)
        .maybe_single()
        .execute()
    )

    if not txn_res.data:
        return RedirectResponse(
            f"{app_url}/dashboard/subscribe?error=verification_failed",
            status_code=302,
        )

    txn = txn_res.data

    if txn["status"] == "success":
        return RedirectResponse(
            f"{app_url}/dashboard/subscribe?subscribed=true",
            status_code=302,
        )

    # Verify with PayVessel
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            pv_res = await client.get(
                PAYVESSEL_VERIFY_URL.format(reference=reference),
                headers={"Authorization": f"Bearer {PAYVESSEL_SECRET_KEY}"},
            )

        pv_json = pv_res.json()
        print(f"[Callback] verify status={pv_res.status_code} ref={reference} body={pv_json}")

        if not pv_json.get("requestSuccessful"):
            return RedirectResponse(
                f"{app_url}/dashboard/subscribe?error=verification_failed",
                status_code=302,
            )

        pv_data = pv_json.get("data", {})
        pv_status = str(pv_data.get("status", "")).lower()

        if pv_status not in ("success", "successful"):
            supabase.table("payment_transactions").update({
                "status":        "failed",
                "failed_reason": f"PayVessel status: {pv_status}",
            }).eq("gateway_ref", reference).execute()
            return RedirectResponse(
                f"{app_url}/dashboard/subscribe?error=verification_failed",
                status_code=302,
            )

        # Amount check
        pv_amount = pv_data.get("amount")
        if pv_amount:
            try:
                pv_amount_kobo = int(float(pv_amount) * 100)
                if pv_amount_kobo != txn["amount_kobo"]:
                    supabase.table("payment_transactions").update({
                        "status":        "failed",
                        "failed_reason": (
                            f"Amount mismatch: got {pv_amount_kobo} kobo, "
                            f"expected {txn['amount_kobo']}"
                        ),
                    }).eq("gateway_ref", reference).execute()
                    return RedirectResponse(
                        f"{app_url}/dashboard/subscribe?error=amount_mismatch",
                        status_code=302,
                    )
            except (ValueError, TypeError):
                pass

        await _activate_subscription(
            user_id=txn["user_id"],
            plan_slug=txn["plan"],
            pv_data=pv_data,
            reference=reference,
        )

        return RedirectResponse(
            f"{app_url}/dashboard/subscribe?subscribed=true",
            status_code=302,
        )

    except Exception as e:
        print(f"[Callback] error ref={reference}: {e}")
        return RedirectResponse(
            f"{app_url}/dashboard/subscribe?error=verification_failed",
            status_code=302,
        )


# ─── POST /api/payments/verify-reference ────────────────────────────────────

@router.post("/verify-reference")
async def verify_reference(body: dict, request: Request):
    """Server-to-server endpoint called by Next.js callback route."""
    if request.headers.get("X-Internal-Key") != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    reference = body.get("reference")
    if not reference:
        raise HTTPException(status_code=400, detail="Reference required")

    txn_res = (
        supabase.table("payment_transactions")
        .select("*")
        .eq("gateway_ref", reference)
        .maybe_single()
        .execute()
    )

    if not txn_res.data:
        return {"status": "not_found"}

    txn = txn_res.data

    if txn["status"] == "success":
        return {"status": "already_verified", "expires_at": None}

    async with httpx.AsyncClient(timeout=30) as client:
        pv_res = await client.get(
            PAYVESSEL_VERIFY_URL.format(reference=reference),
            headers={"Authorization": f"Bearer {PAYVESSEL_SECRET_KEY}"},
        )

    pv_json = pv_res.json()
    if not pv_json.get("requestSuccessful"):
        return {"status": "failed", "detail": "PayVessel verify failed"}

    pv_data = pv_json.get("data", {})
    pv_status = str(pv_data.get("status", "")).lower()

    if pv_status not in ("success", "successful"):
        supabase.table("payment_transactions").update({
            "status":        "failed",
            "failed_reason": f"PayVessel status: {pv_status}",
        }).eq("gateway_ref", reference).execute()
        return {"status": "failed", "detail": f"Payment status: {pv_status}"}

    pv_amount = pv_data.get("amount")
    if pv_amount:
        try:
            pv_amount_kobo = int(float(pv_amount) * 100)
            if pv_amount_kobo != txn["amount_kobo"]:
                supabase.table("payment_transactions").update({
                    "status":        "failed",
                    "failed_reason": f"Amount mismatch: got {pv_amount_kobo}, expected {txn['amount_kobo']}",
                }).eq("gateway_ref", reference).execute()
                return {"status": "failed", "detail": "Amount mismatch"}
        except (ValueError, TypeError):
            pass

    result = await _activate_subscription(
        user_id=txn["user_id"],
        plan_slug=txn["plan"],
        pv_data=pv_data,
        reference=reference,
    )
    return result


# ─── POST /api/payments/webhook ─────────────────────────────────────────────

@router.post("/webhook")
async def payvessel_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("x-payvessel-signature", "")

    if not PAYVESSEL_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment secret not configured")

    expected = hmac.HMAC(
        key=PAYVESSEL_SECRET_KEY.encode("utf-8"),
        msg=body,
        digestmod=hashlib.sha512,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event")
    data = payload.get("data", {})

    print(f"[Webhook] event={event} ref={data.get('reference')}")

    if event not in ("charge.success", "transaction.success"):
        return {"status": "ignored"}

    reference = data.get("reference", "")
    pv_amount = data.get("amount")
    pv_status = str(data.get("status", "")).lower()

    if pv_status not in ("success", "successful"):
        return {"status": "ignored"}

    if not reference.startswith("SPARKL-"):
        return {"status": "ignored"}

    try:
        txn_res = (
            supabase.table("payment_transactions")
            .select("*")
            .eq("gateway_ref", reference)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="DB error")

    if not txn_res.data:
        print(f"[Webhook] Transaction not found for ref={reference}")
        return {"status": "not_found"}

    txn = txn_res.data

    if txn["status"] == "success":
        print(f"[Webhook] Already verified ref={reference}")
        return {"status": "already_verified"}

    if pv_amount:
        try:
            pv_amount_kobo = int(float(pv_amount) * 100)
            if pv_amount_kobo != txn["amount_kobo"]:
                supabase.table("payment_transactions").update({
                    "status":        "failed",
                    "failed_reason": (
                        f"Webhook amount mismatch: got {pv_amount_kobo} kobo, "
                        f"expected {txn['amount_kobo']}"
                    ),
                }).eq("gateway_ref", reference).execute()
                print(f"[Webhook] Amount mismatch ref={reference}")
                return {"status": "amount_mismatch"}
        except (ValueError, TypeError):
            pass

    try:
        await _activate_subscription(
            user_id=txn["user_id"],
            plan_slug=txn["plan"],
            pv_data=data,
            reference=reference,
        )
        print(f"[Webhook] Activated user={txn['user_id']} plan={txn['plan']} ref={reference}")
    except Exception as e:
        print(f"[Webhook] Activation error ref={reference}: {e}")
        raise HTTPException(status_code=500, detail="Activation failed")

    return {"status": "success"}


# ─── POST /api/payments/verify ──────────────────────────────────────────────

@router.post("/verify")
async def verify_payment(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    reference = body.get("reference")
    our_reference = body.get("our_reference", reference)
    pv_data: dict | None = body.get("pv_data")

    if not reference:
        raise HTTPException(status_code=400, detail="Reference is required")

    txn = None
    for ref in list(dict.fromkeys([our_reference, reference])):
        try:
            txn_res = (
                supabase.table("payment_transactions")
                .select("*")
                .eq("gateway_ref", ref)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if txn_res.data:
                txn = txn_res.data
                break
        except Exception:
            continue

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn["status"] == "success":
        return {"status": "already_verified", "message": "Subscription already active"}

    if pv_data:
        print(f"[Verify] Using pv_data from proxy for ref={reference}")
    else:
        if not PAYVESSEL_SECRET_KEY:
            raise HTTPException(status_code=500, detail="Payment secret not configured")

        try:
            async with httpx.AsyncClient() as client:
                pv_res = await client.get(
                    PAYVESSEL_VERIFY_URL.format(reference=reference),
                    headers={
                        "Authorization": f"Bearer {PAYVESSEL_SECRET_KEY}",
                        "Content-Type":  "application/json",
                    },
                    timeout=15.0,
                )
            print(f"[Verify] status={pv_res.status_code} body={pv_res.text}")
            pv_json = pv_res.json()

            if not pv_json.get("requestSuccessful"):
                raise HTTPException(
                    status_code=502,
                    detail=pv_json.get("message", "PayVessel verification failed"),
                )

            pv_data = pv_json.get("data", {})

        except HTTPException:
            raise
        except Exception as e:
            print(f"[Verify direct error] {str(e)}")
            raise HTTPException(status_code=502, detail=f"Could not reach PayVessel: {str(e)}")

    pv_status = str(pv_data.get("status", "")).lower()
    pv_amount = pv_data.get("amount")

    print(f"[Verify] pv_status={pv_status}")

    if pv_status not in ("success", "successful"):
        supabase.table("payment_transactions").update({
            "status":        "failed",
            "failed_reason": f"PayVessel status: {pv_status}",
        }).eq("gateway_ref", txn["gateway_ref"]).execute()
        raise HTTPException(status_code=400, detail=f"Payment not successful: {pv_status}")

    if pv_amount:
        try:
            pv_amount_kobo = int(float(pv_amount) * 100)
            if pv_amount_kobo != txn["amount_kobo"]:
                supabase.table("payment_transactions").update({
                    "status":        "failed",
                    "failed_reason": (
                        f"Amount mismatch: got {pv_amount_kobo} kobo, "
                        f"expected {txn['amount_kobo']} kobo"
                    ),
                }).eq("gateway_ref", txn["gateway_ref"]).execute()
                raise HTTPException(status_code=400, detail="Amount mismatch")
        except (ValueError, TypeError):
            pass

    return await _activate_subscription(
        user_id=user_id,
        plan_slug=txn["plan"],
        pv_data=pv_data,
        reference=txn["gateway_ref"],
    )


# ─── POST /api/payments/admin/grant ─────────────────────────────────────────

@router.post("/admin/grant")
async def admin_grant_subscription(
    body: dict,
    admin_id: str = Depends(get_current_admin),
):
    target_user_id = body.get("user_id")
    plan_slug = body.get("plan")
    note = body.get("note", "Manual grant by admin")

    if not target_user_id or not plan_slug:
        raise HTTPException(status_code=400, detail="user_id and plan are required")

    if plan_slug == "free":
        raise HTTPException(status_code=400, detail="Cannot manually grant free plan")

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

    reference = f"MANUAL-{uuid4().hex[:12].upper()}"

    supabase.table("payment_transactions").insert({
        "user_id":     target_user_id,
        "plan":        plan_slug,
        "gateway":     "manual",
        "gateway_ref": reference,
        "amount_kobo": 0,
        "currency":    "NGN",
        "status":      "pending",
    }).execute()

    result = await _activate_subscription(
        user_id=target_user_id,
        plan_slug=plan_slug,
        pv_data={"manual_grant": True, "note": note, "granted_by": admin_id},
        reference=reference,
    )

    print(f"[Admin grant] by={admin_id} user={target_user_id} plan={plan_slug} note={note}")
    return {**result, "note": note}


# ─── POST /api/payments/admin/revoke ────────────────────────────────────────

@router.post("/admin/revoke")
async def admin_revoke_subscription(
    body: dict,
    admin_id: str = Depends(get_current_admin),
):
    target_user_id = body.get("user_id")
    note = body.get("note", "Subscription revoked by admin")

    if not target_user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    now_iso = datetime.now(timezone.utc).isoformat()

    supabase.table("subscriptions").update({
        "status":     "cancelled",
        "expires_at": now_iso,
        "auto_renew": False,
    }).eq("user_id", target_user_id).eq("status", "active").execute()

    supabase.table("profiles").update({
        "subscription_plan":  "free",
        "subscription_expic": None,
    }).eq("id", target_user_id).execute()

    print(f"[Admin revoke] by={admin_id} user={target_user_id} note={note}")
    return {"status": "revoked", "plan": "free", "note": note}


# ─── Shared subscription activation ─────────────────────────────────────────

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

        expires_at  = base + timedelta(days=plan["duration_days"])
        expires_iso = expires_at.isoformat()

        supabase.table("subscriptions").update({
            "plan":       plan_slug,
            "status":     "active",
            "expires_at": expires_iso,
            "auto_renew": True,
        }).eq("id", existing_sub["id"]).execute()

        subscription_id = existing_sub["id"]
    else:
        expires_at  = now + timedelta(days=plan["duration_days"])
        expires_iso = expires_at.isoformat()

        sub_res = supabase.table("subscriptions").insert({
            "user_id":    user_id,
            "plan":       plan_slug,
            "status":     "active",
            "started_at": now.isoformat(),
            "expires_at": expires_iso,
            "auto_renew": True,
        }).execute()

        subscription_id = (sub_res.data or [{}])[0].get("id")

    supabase.table("payment_transactions").update({
        "status":          "success",
        "paid_at":         now.isoformat(),
        "subscription_id": subscription_id,
        "gateway_payload": pv_data,
    }).eq("gateway_ref", reference).execute()

    profile_update = supabase.table("profiles").update({
        "subscription_plan":  plan_slug,
        "subscription_expic": expires_iso,
    }).eq("id", user_id).execute()

    print(f"[Activate] user={user_id} plan={plan_slug} expires={expires_iso} profile={profile_update.data}")

    return {
        "status":       "success",
        "plan":         plan_slug,
        "display_name": plan["display_name"],
        "expires_at":   expires_iso,
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

    data       = profile_res.data or {}
    plan       = data.get("subscription_plan") or "free"
    expires_at = data.get("subscription_expic")
    created_at = data.get("created_at")

    limits = get_plan_limits(plan, expires_at, created_at)

    effective_plan = (
        "trial" if limits.get("is_trial")
        else (plan if limits["is_paid"] else "free")
    )

    return {
        **limits,
        "plan":           effective_plan,
        "effective_plan": effective_plan,
        "expires_at":     expires_at,
    }