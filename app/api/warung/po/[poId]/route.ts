import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ poId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { poId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_po/${encodeURIComponent(poId)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("PO tidak ditemukan.");
    const j: any = await getRes.json();
    const status = j.fields?.status?.stringValue || "DRAFT";

    if (action === "ORDER") {
      if (status !== "DRAFT") return errorResponse("Hanya DRAFT bisa ORDER.", 400);
      const mask = "updateMask.fieldPaths=status&updateMask.fieldPaths=orderedAt&updateMask.fieldPaths=orderedBy";
      const res = await warungFsFetch(`${docUrl}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { status: { stringValue: "ORDERED" }, orderedAt: { timestampValue: new Date().toISOString() }, orderedBy: { stringValue: user.id } } }),
      });
      if (!res.ok) return errorResponse("Gagal update status.", 500);
      await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "ORDER_PO", entity: "warung_po", entityId: poId });
      return okResponse({ poId, status: "ORDERED" }, "PO ditandai ORDERED.");
    }

    if (action === "CANCEL") {
      if (status === "RECEIVED") return errorResponse("PO sudah RECEIVED, tidak bisa cancel.", 400);
      const mask = "updateMask.fieldPaths=status&updateMask.fieldPaths=cancelledAt&updateMask.fieldPaths=cancelledBy";
      const res = await warungFsFetch(`${docUrl}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { status: { stringValue: "CANCELLED" }, cancelledAt: { timestampValue: new Date().toISOString() }, cancelledBy: { stringValue: user.id } } }),
      });
      if (!res.ok) return errorResponse("Gagal cancel PO.", 500);
      await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "CANCEL_PO", entity: "warung_po", entityId: poId });
      return okResponse({ poId, status: "CANCELLED" }, "PO dibatalkan.");
    }

    return errorResponse("action harus ORDER atau CANCEL.", 400);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ poId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { poId } = await ctx.params;
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_po/${encodeURIComponent(poId)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("PO tidak ditemukan.");
    const j: any = await getRes.json();
    if (j.fields?.status?.stringValue !== "DRAFT") return errorResponse("Hanya DRAFT bisa dihapus.", 400);

    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) return errorResponse("Gagal hapus PO.", 500);

    await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "DELETE_PO", entity: "warung_po", entityId: poId });
    return okResponse({ poId }, "PO dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}