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
  if (!code) return errorResponse("Kode produk tidak valid.");

  const body = await request.json().catch(() => ({}));
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_products/${encodeURIComponent(code)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Produk tidak ditemukan.");
    const before: any = await getRes.json();
    const oldSku = before.fields?.sku?.stringValue || "";

    const updateFields: any = { updatedAt: { timestampValue: new Date().toISOString() } };
    const updateMask: string[] = ["updatedAt"];

    const strFields = ["name", "sku", "barcode", "unit", "stockCategory", "notes"] as const;
    for (const k of strFields) {
      if (body[k] !== undefined) {
        updateFields[k] = { stringValue: String(body[k]).trim() };
        updateMask.push(k);
      }
    }

    for (const k of ["capitalPrice", "sellingPrice", "minStock"] as const) {
      if (body[k] !== undefined) {
        const v = Math.floor(Number(body[k]));
        updateFields[k] = { integerValue: String(k === "minStock" ? v : Math.max(0, v)) };
        updateMask.push(k);
      }
    }

    if (body.active !== undefined) {
      updateFields.active = { booleanValue: Boolean(body.active) };
      updateMask.push("active");
    }

    // Cek SKU unik kalau diubah
    if (body.sku !== undefined) {
      const newSku = String(body.sku).trim();
      if (newSku && newSku !== oldSku) {
        const listRes = await warungFsFetch(`${base}/warung_products?pageSize=500`);
        if (listRes.ok) {
          const listData: any = await listRes.json();
          const exists = (listData.documents || []).some((d: any) =>
            d.name.split("/").pop() !== code && d.fields?.sku?.stringValue === newSku
          );
          if (exists) return errorResponse(`SKU "${newSku}" sudah dipakai produk lain.`, 409);
        }
      }
    }

    const maskQuery = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await warungFsFetch(`${docUrl}?${maskQuery}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: updateFields }),
    });
    if (!res.ok) return errorResponse("Gagal update produk.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "UPDATE_PRODUCT",
      entity: "warung_products",
      entityId: code,
      after: body,
    });

    return okResponse({ code }, "Produk diperbarui.");
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
    const docUrl = `${base}/warung_products/${encodeURIComponent(code)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Produk tidak ditemukan.");

    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) return errorResponse("Gagal hapus produk.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "DELETE_PRODUCT",
      entity: "warung_products",
      entityId: code,
    });

    return okResponse({ code }, "Produk dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}