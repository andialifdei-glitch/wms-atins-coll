import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { okResponse, errorResponse, unauthorizedResponse } from "@/lib/warung/response";
import { computeIncomeStatement } from "@/lib/warung/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const defaultEndStr = `${defaultEnd.getFullYear()}-${String(defaultEnd.getMonth() + 1).padStart(2, "0")}-${String(defaultEnd.getDate()).padStart(2, "0")}`;

  const periodStart = from || defaultStart;
  const periodEnd = to || defaultEndStr;
  if (periodStart > periodEnd) return errorResponse("Tanggal from > to.", 400);

  try {
    const data = await computeIncomeStatement(periodStart, periodEnd);
    return okResponse(data);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}