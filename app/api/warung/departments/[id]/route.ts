import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { id } = await ctx.params;
  if (!id) return errorResponse("ID departemen tidak valid.");

  const body = await request.json().catch(() => ({}));
  const deptName = body.deptName !== undefined ? String(body.deptName).trim() : undefined;
  const active = body.active !== undefined ? Boolean(body.active) : undefined;

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_departments/${encodeURIComponent(id)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Departemen tidak ditemukan.");

    const updateFields: any = { updatedAt: { timestampValue: new Date().toISOString() } };
    const updateMask: string[] = ["updatedAt"];
    if (deptName !== undefined) { updateFields.deptName = { stringValue: deptName }; updateMask.push("deptName"); }
    if (active !== undefined) { updateFields.active = { booleanValue: active }; updateMask.push("active"); }

    const maskQuery = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await warungFsFetch(`${docUrl}?${maskQuery}`, { method: "PATCH", body: JSON.stringify({ fields: updateFields }) });
    if (!res.ok) return errorResponse("Gagal update departemen.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "UPDATE_DEPARTMENT",
      entity: "warung_departments",
      entityId: id,
      after: { deptName, active },
    });

    return okResponse({ id, deptName, active }, "Departemen diperbarui.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { id } = await ctx.params;
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_departments/${encodeURIComponent(id)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Departemen tidak ditemukan.");

    // Cek dipakai di family
    const famRes = await warungFsFetch(`${base}/warung_families?pageSize=300`);
    if (famRes.ok) {
      const famData: any = await famRes.json();
      const [div, dept] = id.split("-");
      const used = (famData.documents || []).some((d: any) => {
        return d.fields?.divCode?.stringValue === div && d.fields?.deptCode?.stringValue === dept;
      });
      if (used) return errorResponse("Departemen dipakai family. Soft-delete dengan active=false atau hapus family dulu.", 409);
    }

    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) return errorResponse("Gagal hapus departemen.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "DELETE_DEPARTMENT",
      entity: "warung_departments",
      entityId: id,
    });

    return okResponse({ id }, "Departemen dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}