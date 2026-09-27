import { NextRequest, NextResponse } from "next/server";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
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

    // Step 1 — verify with Paystack from server (no CORS issues)
    const psRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const psData = await psRes.json();
    console.log("[Verify] Paystack response:", JSON.stringify(psData));

    if (!psRes.ok || !psData.status) {
      return NextResponse.json(
        { detail: psData.message ?? "Paystack verification failed" },
        { status: 400 }
      );
    }

    // Step 2 — forward to FastAPI backend to activate subscription
    const backendRes = await fetch(`${BACKEND_URL}/api/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        reference,
        our_reference: our_reference ?? reference,
        ps_data: psData.data, // pass Paystack data to backend
      }),
    });

    const backendData = await backendRes.json();
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