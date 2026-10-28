import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { id, itemId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const physicalQty = Number(body.physicalQty);
  if (!Number.isFinite(physicalQty)) return errorResponse("physicalQty wajib angka.");

  try {
    const base = warungDatastoreBase();
    const headRes = await warungFsFetch(`${base}/warung_stock_opnames/${encodeURIComponent(id)}`);
    if (!headRes.ok) return notFoundResponse("Opname tidak ditemukan.");
    const hj: any = await headRes.json();
    const status = hj.fields?.status?.stringValue || "DRAFT";
    if (status !== "DRAFT" && status !== "REVIEW") return errorResponse("Hanya DRAFT/REVIEW bisa ubah item.", 400);

    const itemUrl = `${base}/warung_stock_opnames_items/${encodeURIComponent(itemId)}`;
    const itemRes = await warungFsFetch(itemUrl);
    if (!itemRes.ok) return notFoundResponse("Item tidak ditemukan.");
    const ij: any = await itemRes.json();
    const systemQty = parseInt(ij.fields?.systemQty?.integerValue || "0", 10);
    const cost = parseInt(ij.fields?.cost?.integerValue || "0", 10);
    const diffQty = physicalQty - systemQty;
    const diffValue = diffQty * cost;

    const mask = "updateMask.fieldPaths=physicalQty&updateMask.fieldPaths=diffQty&updateMask.fieldPaths=diffValue";
    const res = await warungFsFetch(`${itemUrl}?${mask}`, {
      method: "PATCH",
      body: JSON.stringify({
        fields: {
          physicalQty: { integerValue: String(physicalQty) },
          diffQty: { integerValue: String(diffQty) },
          diffValue: { integerValue: String(diffValue) },
        },
      }),
    });
    if (!res.ok) return errorResponse("Gagal update item.", 500);
    return okResponse({ itemId, physicalQty, diffQty, diffValue }, "Item diperbarui.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}