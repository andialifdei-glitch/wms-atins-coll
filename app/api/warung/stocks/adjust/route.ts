import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { applyStockMutation } from "@/lib/warung/stocks";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const body = await request.json().catch(() => ({}));
  const productCode = String(body.productCode || "").trim();
  const signedQty = Math.trunc(Number(body.qty || 0));
  const notes = String(body.notes || "").trim();
  const type = ["IN", "OUT", "ADJ"].includes(String(body.type)) ? String(body.type) : "ADJ";

  if (!productCode) return errorResponse("productCode wajib.");
  if (!signedQty) return errorResponse("qty harus != 0.");
  if (type === "IN" && signedQty < 0) return errorResponse("IN harus qty positif.");
  if (type === "OUT" && signedQty > 0) return errorResponse("OUT harus qty negatif.");

  try {
    const base = warungDatastoreBase();
    const prodRes = await warungFsFetch(`${base}/warung_products/${encodeURIComponent(productCode)}`);
    if (!prodRes.ok) return errorResponse("Produk tidak ditemukan.", 404);

    const result = await applyStockMutation({
      productCode,
      signedQty,
      type,
      refType: "MANUAL",
      notes,
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      allowNegative: true, // manual adjust boleh negatif
    });

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "STOCK_ADJUST",
      entity: "warung_stocks",
      entityId: productCode,
      after: { qty: result.balanceAfter, type, signedQty },
    });

    return okResponse({ productCode, ...result }, "Stok disesuaikan.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}