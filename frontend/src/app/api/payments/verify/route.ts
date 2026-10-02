// src/app/api/payments/verify/route.ts

import { NextRequest, NextResponse } from "next/server";

// PAYVESSEL_SECRET_KEY has no NEXT_PUBLIC_ prefix — server-side only. Good.
const PAYVESSEL_SECRET_KEY = process.env.PAYVESSEL_SECRET_KEY!;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reference, our_reference, access_token } = body;

    if (!reference || !access_token) {
      return NextResponse.json(
        { detail: "Missing reference or token" },
        { status: 400 }
      );
    }

    if (!PAYVESSEL_SECRET_KEY) {
      console.error("[Verify] PAYVESSEL_SECRET_KEY is not set");
      return NextResponse.json(
        { detail: "Payment configuration error" },
        { status: 500 }
      );
    }

    if (!BACKEND_URL) {
      console.error("[Verify] NEXT_PUBLIC_API_URL is not set");
      return NextResponse.json(
        { detail: "Backend configuration error" },
        { status: 500 }
      );
    }

    // Step 1 — Verify with PayVessel from the server side.
    // This avoids CORS errors that would occur if the browser called PayVessel directly.
    // We use the secret key here (safe — this is a server-side route handler).
    const pvRes = await fetch(
      `https://api.payvessel.com/api/externals/transactions/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYVESSEL_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let pvData: Record<string, unknown>;
    try {
      pvData = await pvRes.json();
    } catch {
      console.error("[Verify] PayVessel response was not valid JSON");
      return NextResponse.json(
        { detail: "PayVessel returned an invalid response" },
        { status: 502 }
      );
    }

    console.log("[Verify] PayVessel response:", JSON.stringify(pvData));

    // PayVessel returns requestSuccessful: false even on 200 for unknown references,
    // so check the flag rather than just the HTTP status.
    if (!pvRes.ok || pvData.requestSuccessful === false) {
      return NextResponse.json(
        { detail: (pvData.message as string) ?? "PayVessel verification failed" },
        { status: 400 }
      );
    }

    const pvPaymentData = (pvData.data ?? pvData) as Record<string, unknown>;

    // Quick client-side status check before hitting the backend.
    // This catches clear failures early without burning a backend call.
    const pvStatus = String(pvPaymentData?.status ?? "").toLowerCase();
    if (pvStatus && !["success", "successful"].includes(pvStatus)) {
      return NextResponse.json(
        { detail: `Payment not successful: ${pvStatus}` },
        { status: 400 }
      );
    }

    // Step 2 — Forward to the FastAPI backend to activate the subscription.
    // We pass pv_data so the backend can skip its own PayVessel call (it already
    // has the verified data) and go straight to the amount check + activation.
    const backendRes = await fetch(`${BACKEND_URL}/api/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        reference,
        our_reference: our_reference ?? reference,
        pv_data: pvPaymentData,
      }),
    });

    let backendData: Record<string, unknown>;
    try {
      backendData = await backendRes.json();
    } catch {
      console.error("[Verify] Backend response was not valid JSON, status:", backendRes.status);
      return NextResponse.json(
        { detail: "Backend returned an invalid response" },
        { status: 502 }
      );
    }

    console.log("[Verify] Backend response:", backendRes.status, JSON.stringify(backendData));

    return NextResponse.json(backendData, { status: backendRes.status });

  } catch (err) {
    console.error("[Verify proxy error]", err);
    return NextResponse.json(
      { detail: "Verification failed" },
      { status: 502 }
    );
  }
}
