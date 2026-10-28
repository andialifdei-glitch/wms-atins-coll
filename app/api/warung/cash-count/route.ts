import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

interface LogEntry {
  action: string;
  at: string;
  by: string;
  amount?: number;
  notes?: string;
}

function docToCc(d: any) {
  const f = d.fields || {};
  const logsRaw = f.logs?.arrayValue?.values || [];
  const logs: LogEntry[] = logsRaw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      action: m.action?.stringValue || "",
      at: m.at?.timestampValue || "",
      by: m.by?.stringValue || "",
      amount: m.amount?.integerValue ? parseInt(m.amount.integerValue, 10) : undefined,
      notes: m.notes?.stringValue || "",
    };
  });
  return {
    ccId: f.ccId?.stringValue || d.name.split("/").pop(),
    countDate: f.countDate?.stringValue || "",
    label: f.label?.stringValue || "OPEN",
    openingAmount: parseInt(f.openingAmount?.integerValue || "0", 10),
    openingAt: f.openingAt?.timestampValue || "",
    openingBy: f.openingBy?.stringValue || "",
    closingAmount: parseInt(f.closingAmount?.integerValue || "0", 10),
    closingAt: f.closingAt?.timestampValue || "",
    closingBy: f.closingBy?.stringValue || "",
    expectedCash: parseInt(f.expectedCash?.integerValue || "0", 10),
    variance: parseInt(f.variance?.integerValue || "0", 10),
    varianceReason: f.varianceReason?.stringValue || "",
    notes: f.notes?.stringValue || "",
    logs,
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const date = (searchParams.get("date") || "").trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_cash_counts?pageSize=200`);
    if (!res.ok) return errorResponse("Gagal baca cash count.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToCc);
    if (date) items = items.filter((x: any) => x.countDate === date);
    items.sort((a: any, b: any) => String(b.countDate).localeCompare(String(a.countDate)));
    return okResponse(items);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

// Create OPEN (pagi)
export async function POST(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const body = await request.json().catch(() => ({}));
  const countDate = String(body.countDate || "").trim() || new Date().toISOString().slice(0, 10);
  const openingAmount = Math.max(0, Math.trunc(Number(body.openingAmount || 0)));
  const notes = String(body.notes || "").trim();

  try {
    const base = warungDatastoreBase();
    const ccId = `CC-${countDate.replace(/-/g, "")}`;

    const checkRes = await warungFsFetch(`${base}/warung_cash_counts/${encodeURIComponent(ccId)}`);
    if (checkRes.ok) return errorResponse(`Cash count untuk tanggal ${countDate} sudah ada.`, 409);

    const nowIso = new Date().toISOString();
    const logsValue = [{
      mapValue: {
        fields: {
          action: { stringValue: "OPEN" },
          at: { timestampValue: nowIso },
          by: { stringValue: user.id },
          amount: { integerValue: String(openingAmount) },
          notes: { stringValue: notes },
        },
      },
    }];

    const payload = {
      fields: {
        ccId: { stringValue: ccId },
        countDate: { stringValue: countDate },
        label: { stringValue: "OPEN" },
        openingAmount: { integerValue: String(openingAmount) },
        openingAt: { timestampValue: nowIso },
        openingBy: { stringValue: user.id },
        closingAmount: { integerValue: "0" },
        expectedCash: { integerValue: "0" },
        variance: { integerValue: "0" },
        varianceReason: { stringValue: "" },
        notes: { stringValue: notes },
        logs: { arrayValue: { values: logsValue } },
        createdAt: { timestampValue: nowIso },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(`${base}/warung_cash_counts/${encodeURIComponent(ccId)}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Gagal simpan cash count.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "OPEN_CASH_COUNT",
      entity: "warung_cash_counts",
      entityId: ccId,
      after: { openingAmount },
    });
    return okResponse({ ccId }, `Cash count ${ccId} dibuka.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}