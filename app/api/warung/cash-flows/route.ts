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

const KAS_CODE = "1-1001";

function docToFlow(d: any) {
  const f = d.fields || {};
  return {
    cfId: f.cfId?.stringValue || d.name.split("/").pop(),
    flowDate: f.flowDate?.stringValue || "",
    flowType: f.flowType?.stringValue || "IN",
    amount: parseInt(f.amount?.integerValue || "0", 10),
    category: f.category?.stringValue || "",
    counterAccount: f.counterAccount?.stringValue || "",
    counterAccountName: f.counterAccountName?.stringValue || "",
    notes: f.notes?.stringValue || "",
    journalId: f.journalId?.stringValue || "",
    status: f.status?.stringValue || "POSTED",
    voidJournalId: f.voidJournalId?.stringValue || "",
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const type = (searchParams.get("flowType") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_cash_flows?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal baca kas.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToFlow);
    if (q) items = items.filter((x: any) => x.cfId.toLowerCase().includes(q) || x.notes.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
    if (type) items = items.filter((x: any) => x.flowType === type);
    if (from) items = items.filter((x: any) => x.flowDate >= from);
    if (to) items = items.filter((x: any) => x.flowDate <= to);
    items.sort((a: any, b: any) => String(b.flowDate).localeCompare(String(a.flowDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
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
  const flowDate = String(body.flowDate || "").trim() || new Date().toISOString().slice(0, 10);
  const flowType = String(body.flowType || "").toUpperCase();
  const amount = Math.max(1, Math.trunc(Number(body.amount || 0)));
  const category = String(body.category || "").trim();
  const counterAccount = String(body.counterAccount || "").trim();
  const notes = String(body.notes || "").trim();

  if (flowType !== "IN" && flowType !== "OUT") return errorResponse("flowType harus IN atau OUT.");
  if (!amount) return errorResponse("amount wajib.");
  if (!counterAccount) return errorResponse("Akun lawan wajib dipilih.");
  if (counterAccount === KAS_CODE) return errorResponse("Akun lawan tidak boleh Kas (1-1001) sendiri.");

  try {
    const coaMap = await getCoaMap();
    if (!coaMap[KAS_CODE]) return errorResponse("Akun Kas (1-1001) tidak ditemukan.", 400);
    if (!coaMap[counterAccount]) return errorResponse("Akun lawan tidak ditemukan: " + counterAccount, 400);

    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = await nextSequence("cf_" + ymd, 1);
    const cfId = `CF-${ymd}-${String(seq).padStart(3, "0")}`;

    // Jurnal double-entry
    const entries = flowType === "IN"
      ? [
          { coaCode: KAS_CODE, coaName: coaMap[KAS_CODE].coaName, debit: amount, credit: 0 },
          { coaCode: counterAccount, coaName: coaMap[counterAccount].coaName, debit: 0, credit: amount },
        ]
      : [
          { coaCode: counterAccount, coaName: coaMap[counterAccount].coaName, debit: amount, credit: 0 },
          { coaCode: KAS_CODE, coaName: coaMap[KAS_CODE].coaName, debit: 0, credit: amount },
        ];

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    const jr = await postJournal(entries, {
      journalDate: flowDate,
      description: `Kas ${flowType === "IN" ? "Masuk" : "Keluar"} ${cfId} — ${category || notes || counterAccount}`,
      refType: flowType === "IN" ? "CASH_IN" : "CASH_OUT",
      refId: cfId,
      actor,
    });

    const base = warungDatastoreBase();
    const payload = {
      fields: {
        cfId: { stringValue: cfId },
        flowDate: { stringValue: flowDate },
        flowType: { stringValue: flowType },
        amount: { integerValue: String(amount) },
        category: { stringValue: category },
        counterAccount: { stringValue: counterAccount },
        counterAccountName: { stringValue: coaMap[counterAccount].coaName },
        notes: { stringValue: notes },
        journalId: { stringValue: jr.journalId },
        status: { stringValue: "POSTED" },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(`${base}/warung_cash_flows/${encodeURIComponent(cfId)}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Jurnal sudah tersimpan, gagal tulis dokumen kas. Cek manual.", 500);

    await writeAuditLog({ actor, action: "CREATE_CASH_FLOW", entity: "warung_cash_flows", entityId: cfId, after: { cfId, flowType, amount, counterAccount } });
    await logActivity({
      category: "CASH_FLOW",
      action: "CREATE",
      entityId: cfId,
      entityLabel: `Kas ${flowType === "IN" ? "Masuk" : "Keluar"} ${cfId} — ${category || counterAccount}`,
      amount,
      journalId: jr.journalId,
      actor,
      notes,
    });

    return okResponse({ cfId, journalId: jr.journalId }, `Kas ${flowType === "IN" ? "Masuk" : "Keluar"} ${cfId} berhasil.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}