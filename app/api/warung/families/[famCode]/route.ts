import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ famCode: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { famCode } = await ctx.params;
  if (!famCode) return errorResponse("famCode tidak valid.");

  const body = await request.json().catch(() => ({}));
  const familyName = body.familyName !== undefined ? String(body.familyName).trim() : undefined;
  const active = body.active !== undefined ? Boolean(body.active) : undefined;

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_families/${encodeURIComponent(famCode)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Family tidak ditemukan.");

    const updateFields: any = { updatedAt: { timestampValue: new Date().toISOString() } };
    const updateMask: string[] = ["updatedAt"];
    if (familyName !== undefined) { updateFields.familyName = { stringValue: familyName }; updateMask.push("familyName"); }
    if (active !== undefined) { updateFields.active = { booleanValue: active }; updateMask.push("active"); }

    const maskQuery = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await warungFsFetch(`${docUrl}?${maskQuery}`, { method: "PATCH", body: JSON.stringify({ fields: updateFields }) });
    if (!res.ok) return errorResponse("Gagal update family.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "UPDATE_FAMILY",
      entity: "warung_families",
      entityId: famCode,
      after: { familyName, active },
    });

    return okResponse({ famCode, familyName, active }, "Family diperbarui.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ famCode: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { famCode } = await ctx.params;
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_families/${encodeURIComponent(famCode)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Family tidak ditemukan.");

    // Cek dipakai di produk
    const prodRes = await warungFsFetch(`${base}/warung_products?pageSize=300`);
    if (prodRes.ok) {
      const prodData: any = await prodRes.json();
      const used = (prodData.documents || []).some((d: any) => d.fields?.famCode?.stringValue === famCode);
      if (used) return errorResponse("Family dipakai produk. Soft-delete dengan active=false atau hapus produk dulu.", 409);
    }

    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) return errorResponse("Gagal hapus family.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "DELETE_FAMILY",
      entity: "warung_families",
      entityId: famCode,
    });

    return okResponse({ famCode }, "Family dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}