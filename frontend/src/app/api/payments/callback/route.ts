import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference") || searchParams.get("txn_ref");

  if (!reference) {
    return NextResponse.redirect(new URL("/dashboard/subscribe?error=no_reference", req.url));
  }

  return NextResponse.redirect(
    new URL(`/dashboard/subscribe/verify?reference=${reference}`, req.url)
  );
}