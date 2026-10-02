import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference =
    searchParams.get("reference") ?? searchParams.get("trxref");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sparkl.com.ng";

  if (!reference) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/subscribe?error=missing_reference`,
      { status: 302 }
    );
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/payments/verify-reference`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": process.env.INTERNAL_SECRET ?? "",
        },
        body: JSON.stringify({ reference }),
      }
    );

    const data = await res.json();
    console.log("[callback] verify-reference response:", data);

    if (data.status === "success" || data.status === "already_verified") {
      return NextResponse.redirect(
        `${appUrl}/dashboard/subscribe?subscribed=true`,
        { status: 302 }
      );
    }
  } catch (err) {
    console.error("[callback] error:", err);
  }

  return NextResponse.redirect(
    `${appUrl}/dashboard/subscribe?error=verification_failed`,
    { status: 302 }
  );
}