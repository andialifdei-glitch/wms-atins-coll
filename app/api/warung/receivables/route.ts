import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { getCoaMap } from "@/lib/warung/coa";
import { postJournal } from "@/lib/warung/journals";
import { nextSequence } from "@/lib/warung/counters";

export const dynamic = "force-dynamic";

const AR_CODE = "1-1020";
const SALES_CODE = "4-4010";
const KAS_CODE = "1-1001";

export interface ArPayment { payId: string; payDate: string; amount: number; journalId: string; notes: string; voidJournalId?: string; voided?: boolean; }

function docToAr(d: any) {
  const f = d.fields || {};
  const payRaw = f.payments?.arrayValue?.values || [];
  const payments: ArPayment[] = payRaw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      payId: m.payId?.stringValue || "",
      payDate: m.payDate?.stringValue || "",
      amount: parseInt(m.amount?.integerValue || "0", 10),
      journalId: m.journalId?.stringValue || "",
      notes: m.notes?.stringValue || "",
      voidJournalId: m.voidJournalId?.stringValue || "",
      voided: m.voided?.booleanValue || false,
    };
  });
  const amount = parseInt(f.amount?.integerValue || "0", 10);
  const paidAmount = parseInt(f.paidAmount?.integerValue || "0", 10);
  return {
    arId: f.arId?.stringValue || d.name.split("/").pop(),
    customerName: f.customerName?.stringValue || "",
    arDate: f.arDate?.stringValue || "",
    dueDate: f.dueDate?.stringValue || "",
    amount,
    paidAmount,
    remainingAmount: amount - paidAmount,
    status: f.status?.stringValue || "OPEN",
    notes: f.notes?.stringValue || "",
    createJournalId: f.createJournalId?.stringValue || "",
    payments,
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const status = (searchParams.get("status") || "").trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_receivables?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal baca piutang.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToAr);
    if (q) items = items.filter((x: any) => x.arId.toLowerCase().includes(q) || x.customerName.toLowerCase().includes(q));
    if (status) items = items.filter((x: any) => x.status === status);
    items.sort((a: any, b: any) => String(b.arDate).localeCompare(String(a.arDate)));
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
  const customerName = String(body.customerName || "").trim();
  const arDate = String(body.arDate || "").trim() || new Date().toISOString().slice(0, 10);
  const dueDate = String(body.dueDate || "").trim();
  const amount = Math.max(1, Math.trunc(Number(body.amount || 0)));
  const notes = String(body.notes || "").trim();

  if (!customerName) return errorResponse("Nama customer wajib.");
  if (!amount) return errorResponse("amount wajib.");

  try {
    const coaMap = await getCoaMap();
    if (!coaMap[AR_CODE]) return errorResponse("Akun Piutang (1-1020) tidak ada.", 400);
    if (!coaMap[SALES_CODE]) return errorResponse("Akun Penjualan (4-4010) tidak ada.", 400);

    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = await nextSequence("ar_" + ymd, 1);
    const arId = `AR-${ymd}-${String(seq).padStart(3, "0")}`;

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };

    const jr = await postJournal([
      { coaCode: AR_CODE, coaName: coaMap[AR_CODE].coaName, debit: amount, credit: 0 },
      { coaCode: SALES_CODE, coaName: coaMap[SALES_CODE].coaName, debit: 0, credit: amount },
    ], {
      journalDate: arDate,
      description: `Piutang Baru ${arId} — ${customerName}`,
      refType: "RECEIVABLE_CREATE",
      refId: arId,
      actor,
    });

    const base = warungDatastoreBase();
    const payload = {
      fields: {
        arId: { stringValue: arId },
        customerName: { stringValue: customerName },
        arDate: { stringValue: arDate },
        dueDate: { stringValue: dueDate },
        amount: { integerValue: String(amount) },
        paidAmount: { integerValue: "0" },
        status: { stringValue: "OPEN" },
        notes: { stringValue: notes },
        createJournalId: { stringValue: jr.journalId },
        payments: { arrayValue: { values: [] } },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(`${base}/warung_receivables/${encodeURIComponent(arId)}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Jurnal sudah, gagal tulis piutang.", 500);

    await writeAuditLog({ actor, action: "CREATE_AR", entity: "warung_receivables", entityId: arId, after: { arId, customerName, amount } });
    await logActivity({ category: "RECEIVABLE", action: "CREATE", entityId: arId, entityLabel: `Piutang ${arId} — ${customerName}`, amount, journalId: jr.journalId, actor, notes });

    return okResponse({ arId, journalId: jr.journalId }, `Piutang ${arId} dibuat.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}