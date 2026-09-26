import { NextRequest, NextResponse } from "next/server";

const PAYVESSEL_BASE_URL =
  process.env.PAYVESSEL_BASE_URL || "https://sandbox.payvessel.com";
const PAYVESSEL_API_KEY = process.env.PAYVESSEL_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("[Checkout proxy] sending to PayVessel:", JSON.stringify(body));
    console.log("[Checkout proxy] base URL:", PAYVESSEL_BASE_URL);

    const res = await fetch(`${PAYVESSEL_BASE_URL}/pms/transactions/initiate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": PAYVESSEL_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log("[Checkout proxy] raw response:", text);

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json(
        { detail: `PayVessel returned unexpected response: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[Checkout proxy error]", err);
    return NextResponse.json(
      { detail: "Failed to initialize checkout" },
      { status: 502 }
    );
  }
}