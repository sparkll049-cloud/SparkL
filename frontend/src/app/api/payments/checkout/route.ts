import { NextRequest, NextResponse } from "next/server";

const PAYVESSEL_BASE_URL =
  process.env.PAYVESSEL_BASE_URL || "https://sandbox.payvessel.com";
const PAYVESSEL_API_KEY = process.env.PAYVESSEL_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${PAYVESSEL_BASE_URL}/pms/checkout/initialize/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": PAYVESSEL_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log("[Checkout proxy] status:", res.status, JSON.stringify(data));

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[Checkout proxy error]", err);
    return NextResponse.json(
      { detail: "Failed to initialize checkout" },
      { status: 502 }
    );
  }
}