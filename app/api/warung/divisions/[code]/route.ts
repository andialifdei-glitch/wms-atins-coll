import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { code } = await ctx.params;
  if (!code) return errorResponse("Kode divisi tidak valid.");

  const body = await request.json().catch(() => ({}));
  const divName = body.divName !== undefined ? String(body.divName).trim() : undefined;
  const active = body.active !== undefined ? Boolean(body.active) : undefined;

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_divisions/${encodeURIComponent(code)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Divisi tidak ditemukan.");
    const before: any = await getRes.json();

    const updateFields: any = { updatedAt: { timestampValue: new Date().toISOString() } };
    const updateMask: string[] = ["updatedAt"];
    if (divName !== undefined) { updateFields.divName = { stringValue: divName }; updateMask.push("divName"); }
    if (active !== undefined) { updateFields.active = { booleanValue: active }; updateMask.push("active"); }

    const maskQuery = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await warungFsFetch(`${docUrl}?${maskQuery}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: updateFields }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return errorResponse("Gagal update divisi.", 500, { detail: txt.slice(0, 300) });
    }

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "UPDATE_DIVISION",
      entity: "warung_divisions",
      entityId: code,
      before: before.fields,
      after: { divName, active },
    });

    return okResponse({ code, divName, active }, "Divisi diperbarui.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { code } = await ctx.params;
  if (!code) return errorResponse("Kode divisi tidak valid.");

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_divisions/${encodeURIComponent(code)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Divisi tidak ditemukan.");

    // Cek dipakai di departemen
    const depRes = await warungFsFetch(`${base}/warung_departments?pageSize=100`);
    if (depRes.ok) {
      const depData: any = await depRes.json();
      const used = (depData.documents || []).some((d: any) => d.fields?.divCode?.stringValue === code);
      if (used) {
        return errorResponse("Divisi dipakai departemen. Soft-delete dengan active=false atau hapus dept dulu.", 409);
      }
    }

    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) {
      const txt = await res.text();
      return errorResponse("Gagal hapus divisi.", 500, { detail: txt.slice(0, 300) });
    }

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "DELETE_DIVISION",
      entity: "warung_divisions",
      entityId: code,
    });

    return okResponse({ code }, "Divisi dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}