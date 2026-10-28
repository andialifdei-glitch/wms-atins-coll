import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { closePeriod, periodIdFromDate, periodRangeFromId } from "@/lib/warung/fiscal";

export const dynamic = "force-dynamic";

function docToPeriod(d: any) {
  const f = d.fields || {};
  return {
    periodId: f.periodId?.stringValue || d.name.split("/").pop(),
    startDate: f.startDate?.stringValue || "",
    endDate: f.endDate?.stringValue || "",
    status: f.status?.stringValue || "OPEN",
    closedAt: f.closedAt?.timestampValue || "",
    closedBy: f.closedBy?.stringValue || "",
    netIncome: parseInt(f.netIncome?.integerValue || "0", 10),
    closingJournalId: f.closingJournalId?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_fiscal_periods?pageSize=240`);
    if (!res.ok) return errorResponse("Gagal baca periode.", 500);
    const j: any = await res.json();
    const items = (j.documents || []).map(docToPeriod).sort((a: any, b: any) => String(b.periodId).localeCompare(String(a.periodId)));
    return okResponse(items);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const body = await request.json().catch(() => ({}));
  const periodId = String(body.periodId || "").trim() || periodIdFromDate(new Date().toISOString().slice(0, 10));

  if (!/^\d{4}-\d{2}$/.test(periodId)) return errorResponse("periodId harus format YYYY-MM.", 400);

  try {
    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    const result = await closePeriod(periodId, actor);
    const { startDate, endDate } = periodRangeFromId(periodId);
    await writeAuditLog({ actor, action: "CLOSE_PERIOD", entity: "warung_fiscal_periods", entityId: periodId, after: result });
    await logActivity({ category: "JOURNAL", action: "POST", entityId: periodId, entityLabel: `Closing periode ${periodId} (${startDate} s/d ${endDate})`, amount: Math.abs(result.netIncome), journalId: result.closingJournalId, actor });
    return okResponse({
      periodId,
      netIncome: result.netIncome,
      closingJournalId: result.closingJournalId,
    }, `Periode ${periodId} CLOSED. Laba bersih ${result.netIncome}.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}