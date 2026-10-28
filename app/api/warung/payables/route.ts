import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { getCoaMap } from "@/lib/warung/coa";
import { postJournal } from "@/lib/warung/journals";
import { nextSequence } from "@/lib/warung/counters";

export const dynamic = "force-dynamic";

const AP_CODE = "2-2010";
const INVENTORY_CODE = "1-1030";

function docToAp(d: any) {
  const f = d.fields || {};
  const payRaw = f.payments?.arrayValue?.values || [];
  const payments = payRaw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      payId: m.payId?.stringValue || "",
      payDate: m.payDate?.stringValue || "",
      amount: parseInt(m.amount?.integerValue || "0", 10),
      journalId: m.journalId?.stringValue || "",
      notes: m.notes?.stringValue || "",
    };
  });
  const amount = parseInt(f.amount?.integerValue || "0", 10);
  const paidAmount = parseInt(f.paidAmount?.integerValue || "0", 10);
  return {
    apId: f.apId?.stringValue || d.name.split("/").pop(),
    supplierCode: f.supplierCode?.stringValue || "",
    supplierName: f.supplierName?.stringValue || "",
    apDate: f.apDate?.stringValue || "",
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
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_payables?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal baca utang.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToAp);
    if (q) items = items.filter((x: any) => x.apId.toLowerCase().includes(q) || x.supplierName.toLowerCase().includes(q));
    if (status) items = items.filter((x: any) => x.status === status);
    items.sort((a: any, b: any) => String(b.apDate).localeCompare(String(a.apDate)));
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
  const supplierCode = String(body.supplierCode || "").trim();
  const apDate = String(body.apDate || "").trim() || new Date().toISOString().slice(0, 10);
  const dueDate = String(body.dueDate || "").trim();
  const amount = Math.max(1, Math.trunc(Number(body.amount || 0)));
  const notes = String(body.notes || "").trim();

  if (!supplierCode) return errorResponse("Supplier wajib.");
  if (!amount) return errorResponse("amount wajib.");

  try {
    const base = warungDatastoreBase();
    const supRes = await warungFsFetch(`${base}/warung_suppliers/${encodeURIComponent(supplierCode)}`);
    if (!supRes.ok) return errorResponse("Supplier tidak ditemukan.", 400);
    const sj: any = await supRes.json();
    const supplierName = sj.fields?.supplierName?.stringValue || "";

    const coaMap = await getCoaMap();
    if (!coaMap[AP_CODE]) return errorResponse("Akun Utang (2-2010) tidak ada.", 400);
    if (!coaMap[INVENTORY_CODE]) return errorResponse("Akun Persediaan (1-1030) tidak ada.", 400);

    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = await nextSequence("ap_" + ymd, 1);
    const apId = `AP-${ymd}-${String(seq).padStart(3, "0")}`;

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    const jr = await postJournal([
      { coaCode: INVENTORY_CODE, coaName: coaMap[INVENTORY_CODE].coaName, debit: amount, credit: 0 },
      { coaCode: AP_CODE, coaName: coaMap[AP_CODE].coaName, debit: 0, credit: amount },
    ], {
      journalDate: apDate,
      description: `Utang Baru ${apId} — ${supplierName}`,
      refType: "PAYABLE_CREATE",
      refId: apId,
      actor,
    });

    const payload = {
      fields: {
        apId: { stringValue: apId },
        supplierCode: { stringValue: supplierCode },
        supplierName: { stringValue: supplierName },
        apDate: { stringValue: apDate },
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
    const res = await warungFsFetch(`${base}/warung_payables/${encodeURIComponent(apId)}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Jurnal sudah, gagal tulis utang.", 500);

    await writeAuditLog({ actor, action: "CREATE_AP", entity: "warung_payables", entityId: apId, after: { apId, supplierCode, amount } });
    await logActivity({ category: "PAYABLE", action: "CREATE", entityId: apId, entityLabel: `Utang ${apId} — ${supplierName}`, amount, journalId: jr.journalId, actor, notes });
    return okResponse({ apId, journalId: jr.journalId }, `Utang ${apId} dibuat.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}