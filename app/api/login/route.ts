import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Endpoint dialihkan ke client-side auth."
  });
}