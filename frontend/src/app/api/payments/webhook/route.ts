import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-payvessel-signature") ?? "";

    if (!signature) {
      return NextResponse.json({ detail: "Missing signature" }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_API_URL) {
      console.error("[webhook proxy] NEXT_PUBLIC_API_URL is not set");
      return NextResponse.json({ detail: "Configuration error" }, { status: 500 });
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/payments/webhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-payvessel-signature": signature,
        },
        body,
      }
    );

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      console.error("[webhook proxy] backend returned non-JSON, status:", res.status);
      return NextResponse.json({ detail: "Backend error" }, { status: 502 });
    }

    return NextResponse.json(data, { status: res.status });

  } catch (err) {
    console.error("[webhook proxy error]", err);
    return NextResponse.json({ detail: "Proxy error" }, { status: 502 });
  }
}