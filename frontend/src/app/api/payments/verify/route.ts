import { NextRequest, NextResponse } from "next/server";

const PAYVESSEL_BASE_URL =
  process.env.PAYVESSEL_BASE_URL || "https://sandbox.payvessel.com";
const PAYVESSEL_API_KEY = process.env.PAYVESSEL_API_KEY!;
const PAYVESSEL_SECRET_KEY = process.env.PAYVESSEL_SECRET_KEY!;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function POST(req: NextRequest) {
  try {
    const { reference, our_reference, access_token } = await req.json();

    if (!reference || !access_token) {
      return NextResponse.json(
        { detail: "Missing reference or token" },
        { status: 400 }
      );
    }

    // Step 1 — verify with PayVessel from Vercel edge (no egress issues)
    let pvData: unknown = null;
    try {
      const pvRes = await fetch(
        `${PAYVESSEL_BASE_URL}/pms/transactions/${reference}/confirm/`,
        {
          method: "GET",
          headers: {
            "api-key": PAYVESSEL_API_KEY,
            "api-secret": PAYVESSEL_SECRET_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("[Proxy] PayVessel status:", pvRes.status);
      pvData = await pvRes.json();
      console.log("[Proxy] PayVessel response:", JSON.stringify(pvData));
    } catch (pvErr) {
      console.error("[Proxy] PayVessel call failed:", pvErr);
      return NextResponse.json(
        {
          detail:
            "Payment gateway is temporarily unavailable. Your payment was received — please contact support to activate your subscription.",
        },
        { status: 503 }
      );
    }

    // Step 2 — forward result to FastAPI backend to activate subscription
    const backendRes = await fetch(`${BACKEND_URL}/api/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        reference,
        our_reference: our_reference ?? reference,
        pv_data: pvData,
      }),
    });

    const backendData = await backendRes.json();
    console.log("[Proxy] Backend response:", backendRes.status, JSON.stringify(backendData));

    return NextResponse.json(backendData, { status: backendRes.status });
  } catch (err) {
    console.error("[Proxy] verify error:", err);
    return NextResponse.json(
      { detail: "Proxy verification failed" },
      { status: 502 }
    );
  }
}
