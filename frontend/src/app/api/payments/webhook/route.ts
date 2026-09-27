// app/api/payments/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text(); // raw — must not be parsed, signature depends on it
    const signature = req.headers.get("x-paystack-signature") ?? "";

    if (!signature) {
      return NextResponse.json({ detail: "Missing signature" }, { status: 400 });
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/payments/webhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
        body, // forward raw body unchanged — do not JSON.parse/re-stringify
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[webhook proxy error]", err);
    return NextResponse.json({ detail: "Proxy error" }, { status: 502 });
  }
}