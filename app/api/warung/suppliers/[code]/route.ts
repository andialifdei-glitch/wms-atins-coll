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
  if (!code) return errorResponse("Kode supplier tidak valid.");

  const body = await request.json().catch(() => ({}));
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_suppliers/${encodeURIComponent(code)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Supplier tidak ditemukan.");

    const updateFields: any = { updatedAt: { timestampValue: new Date().toISOString() } };
    const updateMask: string[] = ["updatedAt"];

    const strFields = ["supplierName", "phone", "address", "contactPerson", "email", "notes"];
    for (const k of strFields) {
      if (body[k] !== undefined) {
        updateFields[k] = { stringValue: String(body[k]).trim() };
        updateMask.push(k);
      }
    }

    if (body.active !== undefined) {
      updateFields.active = { booleanValue: Boolean(body.active) };
      updateMask.push("active");
    }

    const maskQuery = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await warungFsFetch(`${docUrl}?${maskQuery}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: updateFields }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return errorResponse("Gagal update supplier.", 500, { detail: txt.slice(0, 300) });
    }

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "UPDATE_SUPPLIER",
      entity: "warung_suppliers",
      entityId: code,
      after: body,
    });

    return okResponse({ code }, "Supplier diperbarui.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { code } = await ctx.params;
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_suppliers/${encodeURIComponent(code)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Supplier tidak ditemukan.");

    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) return errorResponse("Gagal hapus supplier.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "DELETE_SUPPLIER",
      entity: "warung_suppliers",
      entityId: code,
    });

    return okResponse({ code }, "Supplier dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}