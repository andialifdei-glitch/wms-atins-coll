import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { voidJournal } from "@/lib/warung/journals";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ cfId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { cfId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();

  if (action !== "VOID") return errorResponse("action harus VOID.", 400);

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_cash_flows/${encodeURIComponent(cfId)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Kas tidak ditemukan.");
    const j: any = await getRes.json();
    if (j.fields?.status?.stringValue === "VOID") return errorResponse("Sudah VOID.", 400);
    const origJournalId = j.fields?.journalId?.stringValue;
    if (!origJournalId) return errorResponse("Kas tidak punya jurnal asal.", 400);

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    const jr = await voidJournal(origJournalId, {
      journalDate: new Date().toISOString().slice(0, 10),
      description: `VOID Kas ${cfId}`,
      refType: "CASH_VOID",
      refId: cfId,
      actor,
    });

    const mask = "updateMask.fieldPaths=status&updateMask.fieldPaths=voidJournalId";
    const res = await warungFsFetch(`${docUrl}?${mask}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { status: { stringValue: "VOID" }, voidJournalId: { stringValue: jr.journalId } } }),
    });
    if (!res.ok) return errorResponse("Jurnal void sudah, gagal update dokumen.", 500);

    await writeAuditLog({ actor, action: "VOID_CASH_FLOW", entity: "warung_cash_flows", entityId: cfId });
    await logActivity({ category: "CASH_FLOW", action: "VOID", entityId: cfId, entityLabel: `VOID Kas ${cfId}`, amount: parseInt(j.fields?.amount?.integerValue || "0", 10), journalId: jr.journalId, actor });
    return okResponse({ cfId, voidJournalId: jr.journalId }, "Kas di-void (jurnal koreksi diposting).");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}