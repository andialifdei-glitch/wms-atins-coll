import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { nextSequence } from "@/lib/warung/counters";
import { applyStockMutation } from "@/lib/warung/stocks";

export const dynamic = "force-dynamic";

function docToBrk(d: any) {
  const f = d.fields || {};
  return {
    breakageId: f.breakageId?.stringValue || d.name.split("/").pop(),
    productCode: f.productCode?.stringValue || "",
    productName: f.productName?.stringValue || "",
    qty: parseInt(f.qty?.integerValue || "0", 10),
    costPerUnit: parseInt(f.costPerUnit?.integerValue || "0", 10),
    totalCost: parseInt(f.totalCost?.integerValue || "0", 10),
    reason: f.reason?.stringValue || "",
    notes: f.notes?.stringValue || "",
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_breakages?pageSize=200`);
    if (!res.ok) return errorResponse("Gagal baca breakage.", 500);
    const j: any = await res.json();
    const items = (j.documents || []).map(docToBrk).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return okResponse(items);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const body = await request.json().catch(() => ({}));
  const productCode = String(body.productCode || "").trim();
  const qty = Math.trunc(Number(body.qty || 0));
  const reason = String(body.reason || "").trim();
  const notes = String(body.notes || "").trim();

  if (!productCode) return errorResponse("productCode wajib.");
  if (qty <= 0) return errorResponse("qty harus > 0.");

  try {
    const base = warungDatastoreBase();
    const prodRes = await warungFsFetch(`${base}/warung_products/${encodeURIComponent(productCode)}`);
    if (!prodRes.ok) return errorResponse("Produk tidak ditemukan.", 404);
    const pj: any = await prodRes.json();
    const productName = pj.fields?.name?.stringValue || "";
    const costPerUnit = parseInt(pj.fields?.capitalPrice?.integerValue || "0", 10);
    const totalCost = qty * costPerUnit;

    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = await nextSequence("brk_" + ymd, 1);
    const breakageId = `BRK-${ymd}-${String(seq).padStart(3, "0")}`;

    // Mutasi stok: keluar (-qty), tidak boleh negatif
    await applyStockMutation({
      productCode,
      signedQty: -Math.abs(qty),
      type: "BRK",
      refType: "BREAKAGE",
      refId: breakageId,
      cost: costPerUnit,
      notes,
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      allowNegative: false,
    });

    const payload = {
      fields: {
        breakageId: { stringValue: breakageId },
        productCode: { stringValue: productCode },
        productName: { stringValue: productName },
        qty: { integerValue: String(qty) },
        costPerUnit: { integerValue: String(costPerUnit) },
        totalCost: { integerValue: String(totalCost) },
        reason: { stringValue: reason },
        notes: { stringValue: notes },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(`${base}/warung_breakages/${encodeURIComponent(breakageId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) return errorResponse("Mutasi stok berhasil, gagal simpan dokumen breakage.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_BREAKAGE",
      entity: "warung_breakages",
      entityId: breakageId,
      after: { productCode, qty, totalCost },
    });

    return okResponse({ breakageId }, `Breakage ${breakageId} berhasil.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}