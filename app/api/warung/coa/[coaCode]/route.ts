import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ coaCode: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { coaCode } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_coa/${encodeURIComponent(coaCode)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("COA tidak ditemukan.");
    const j: any = await getRes.json();
    const isSystem = j.fields?.isSystem?.booleanValue ?? false;

    const updateFields: any = { updatedAt: { timestampValue: new Date().toISOString() } };
    const updateMask: string[] = ["updatedAt"];

    if (body.coaName !== undefined) { updateFields.coaName = { stringValue: String(body.coaName).trim() }; updateMask.push("coaName"); }
    if (body.notes !== undefined) { updateFields.notes = { stringValue: String(body.notes).trim() }; updateMask.push("notes"); }
    if (body.active !== undefined) { updateFields.active = { booleanValue: Boolean(body.active) }; updateMask.push("active"); }

    if (!isSystem) {
      if (body.type !== undefined) {
        const t = String(body.type).toUpperCase();
        if (!["ASET", "KEWAJIBAN", "EKUITAS", "PENDAPATAN", "BEBAN"].includes(t)) return errorResponse("type tidak valid.");
        updateFields.type = { stringValue: t };
        updateMask.push("type");
      }
      if (body.normalBalance !== undefined) {
        const nb = String(body.normalBalance).toUpperCase();
        if (nb !== "DEBIT" && nb !== "KREDIT") return errorResponse("normalBalance tidak valid.");
        updateFields.normalBalance = { stringValue: nb };
        updateMask.push("normalBalance");
      }
    } else {
      if (body.type !== undefined || body.normalBalance !== undefined) {
        return errorResponse("Akun sistem: type & normalBalance terkunci.", 400);
      }
    }

    const maskQuery = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await warungFsFetch(`${docUrl}?${maskQuery}`, { method: "PATCH", body: JSON.stringify({ fields: updateFields }) });
    if (!res.ok) return errorResponse("Gagal update COA.", 500);

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    await writeAuditLog({ actor, action: "UPDATE_COA", entity: "warung_coa", entityId: coaCode, after: body });
    await logActivity({ category: "COA", action: "UPDATE", entityId: coaCode, entityLabel: `COA ${coaCode} diubah`, actor, notes: JSON.stringify(body).slice(0, 200) });

    return okResponse({ coaCode }, "COA diperbarui.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ coaCode: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { coaCode } = await ctx.params;
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_coa/${encodeURIComponent(coaCode)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("COA tidak ditemukan.");
    const j: any = await getRes.json();
    if (j.fields?.isSystem?.booleanValue) return errorResponse("Akun sistem tidak bisa dihapus. Nonaktifkan saja (active=false).", 400);

    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) return errorResponse("Gagal hapus COA.", 500);

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    await writeAuditLog({ actor, action: "DELETE_COA", entity: "warung_coa", entityId: coaCode });
    await logActivity({ category: "COA", action: "DELETE", entityId: coaCode, entityLabel: `COA ${coaCode} dihapus`, actor });
    return okResponse({ coaCode }, "COA dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}