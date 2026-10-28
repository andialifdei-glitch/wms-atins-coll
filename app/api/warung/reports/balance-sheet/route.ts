import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { okResponse, errorResponse, unauthorizedResponse } from "@/lib/warung/response";
import { computeBalanceSheet } from "@/lib/warung/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  const { searchParams } = new URL(request.url);
  const asOf = (searchParams.get("asOf") || "").trim() || new Date().toISOString().slice(0, 10);

  try {
    const data = await computeBalanceSheet(asOf);
    return okResponse(data);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}