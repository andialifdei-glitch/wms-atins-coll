import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { getCoaMap } from "@/lib/warung/coa";
import { postJournal, voidJournal } from "@/lib/warung/journals";

export const dynamic = "force-dynamic";

const AP_CODE = "2-2010";
const KAS_CODE = "1-1001";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ apId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { apId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_payables/${encodeURIComponent(apId)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Utang tidak ditemukan.");
    const j: any = await getRes.json();
    const amount = parseInt(j.fields?.amount?.integerValue || "0", 10);
    const paidAmount = parseInt(j.fields?.paidAmount?.integerValue || "0", 10);
    const remaining = amount - paidAmount;
    const status = j.fields?.status?.stringValue || "OPEN";
    const supplierName = j.fields?.supplierName?.stringValue || "";

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    const coaMap = await getCoaMap();
    if (!coaMap[AP_CODE] || !coaMap[KAS_CODE]) return errorResponse("Akun Utang/Kas tidak ada.", 400);

    if (action === "PAYMENT") {
      if (status === "PAID") return errorResponse("Sudah lunas.", 400);
      if (status === "CANCELLED") return errorResponse("Utang dibatalkan.", 400);
      const payAmount = Math.max(1, Math.trunc(Number(body.payAmount || 0)));
      const payDate = String(body.payDate || "").trim() || new Date().toISOString().slice(0, 10);
      const notes = String(body.notes || "").trim();
      if (payAmount > remaining) return errorResponse(`Pembayaran ${payAmount} melebihi sisa ${remaining}.`, 400);

      const now = Date.now();
      const payId = `PAY-AP-${now}`;
      const jr = await postJournal([
        { coaCode: AP_CODE, coaName: coaMap[AP_CODE].coaName, debit: payAmount, credit: 0 },
        { coaCode: KAS_CODE, coaName: coaMap[KAS_CODE].coaName, debit: 0, credit: payAmount },
      ], {
        journalDate: payDate,
        description: `Bayar Utang ${apId} — ${supplierName}`,
        refType: "PAYABLE_PAYMENT",
        refId: payId,
        actor,
      });

      const oldPayments = j.fields?.payments?.arrayValue?.values || [];
      const newPayment = {
        mapValue: {
          fields: {
            payId: { stringValue: payId },
            payDate: { stringValue: payDate },
            amount: { integerValue: String(payAmount) },
            journalId: { stringValue: jr.journalId },
            notes: { stringValue: notes },
          },
        },
      };
      const newPaidAmount = paidAmount + payAmount;
      const newStatus = newPaidAmount >= amount ? "PAID" : "PARTIAL";
      const mask = "updateMask.fieldPaths=paidAmount&updateMask.fieldPaths=status&updateMask.fieldPaths=payments";
      const res = await warungFsFetch(`${docUrl}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            paidAmount: { integerValue: String(newPaidAmount) },
            status: { stringValue: newStatus },
            payments: { arrayValue: { values: [...oldPayments, newPayment] } },
          },
        }),
      });
      if (!res.ok) return errorResponse("Jurnal sudah, gagal update utang.", 500);

      await writeAuditLog({ actor, action: "AP_PAYMENT", entity: "warung_payables", entityId: apId, after: { payId, payAmount, newStatus } });
      await logActivity({ category: "PAYABLE", action: "PAY", entityId: apId, entityLabel: `Bayar Utang ${apId}`, amount: payAmount, journalId: jr.journalId, actor, notes });
      return okResponse({ apId, paidAmount: newPaidAmount, status: newStatus, journalId: jr.journalId }, `Pembayaran ${payAmount} berhasil.`);
    }

    if (action === "VOID") {
      if (paidAmount > 0) return errorResponse("Sudah ada pembayaran, tidak bisa void.", 400);
      if (status === "CANCELLED") return errorResponse("Sudah dibatalkan.", 400);
      const origJournalId = j.fields?.createJournalId?.stringValue;
      if (!origJournalId) return errorResponse("Tidak ada jurnal asal.", 400);

      const jr = await voidJournal(origJournalId, {
        journalDate: new Date().toISOString().slice(0, 10),
        description: `VOID Utang ${apId}`,
        refType: "PAYABLE_VOID",
        refId: apId,
        actor,
      });
      const mask = "updateMask.fieldPaths=status";
      await warungFsFetch(`${docUrl}?${mask}`, { method: "PATCH", body: JSON.stringify({ fields: { status: { stringValue: "CANCELLED" } } }) });
      await writeAuditLog({ actor, action: "AP_VOID", entity: "warung_payables", entityId: apId });
      await logActivity({ category: "PAYABLE", action: "VOID", entityId: apId, entityLabel: `VOID Utang ${apId}`, amount, journalId: jr.journalId, actor });
      return okResponse({ apId, voidJournalId: jr.journalId }, "Utang di-void.");
    }

    return errorResponse("action harus PAYMENT atau VOID.", 400);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}