import { NextRequest, NextResponse } from "next/server";

const PAYVESSEL_BASE_URL = process.env.PAYVESSEL_BASE_URL || "https://sandbox.payvessel.com";
const PAYVESSEL_API_KEY = process.env.PAYVESSEL_API_KEY!;
const PAYVESSEL_SECRET_KEY = process.env.PAYVESSEL_SECRET_KEY!;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function POST(req: NextRequest) {
  try {
    const { reference, our_reference, access_token } = await req.json();

    if (!reference || !access_token) {
      return NextResponse.json({ detail: "Missing reference or token" }, { status: 400 });
    }

    // Step 1 — call Payvessel from Vercel (no egress issues)
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

    const pvData = await pvRes.json();
    console.log("[Proxy] PayVessel verify response:", JSON.stringify(pvData));

    // Step 2 — forward to FastAPI backend to activate subscription
    const backendRes = await fetch(`${BACKEND_URL}/api/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        reference,
        our_reference,
        pv_data: pvData,
      }),
    });

    const backendData = await backendRes.json();
    return NextResponse.json(backendData, { status: backendRes.status });

  } catch (err) {
    console.error("[Proxy] verify error:", err);
    return NextResponse.json({ detail: "Proxy verification failed" }, { status: 502 });
  }
}