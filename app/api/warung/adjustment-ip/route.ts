import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { nextSequence } from "@/lib/warung/counters";
import { applyBatchStockMutations } from "@/lib/warung/stocks";

export const dynamic = "force-dynamic";

function docToIp(d: any) {
  const f = d.fields || {};
  return {
    txId: f.txId?.stringValue || d.name.split("/").pop(),
    sourceProductCode: f.sourceProductCode?.stringValue || "",
    sourceQty: parseInt(f.sourceQty?.integerValue || "0", 10),
    targetProductCode: f.targetProductCode?.stringValue || "",
    targetQty: parseInt(f.targetQty?.integerValue || "0", 10),
    notes: f.notes?.stringValue || "",
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_adjustment_ip?pageSize=200`);
    if (!res.ok) return errorResponse("Gagal baca adjustment IP.", 500);
    const j: any = await res.json();
    const items = (j.documents || []).map(docToIp).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
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
  const sourceProductCode = String(body.sourceProductCode || "").trim();
  const targetProductCode = String(body.targetProductCode || "").trim();
  const sourceQty = Math.trunc(Number(body.sourceQty || 0));
  const targetQty = Math.trunc(Number(body.targetQty || 0));
  const notes = String(body.notes || "").trim();

  if (!sourceProductCode || !targetProductCode) return errorResponse("source & target wajib.");
  if (sourceProductCode === targetProductCode) return errorResponse("Source & target tidak boleh sama.");
  if (sourceQty <= 0) return errorResponse("sourceQty harus > 0.");
  if (targetQty <= 0) return errorResponse("targetQty harus > 0.");

  try {
    const base = warungDatastoreBase();
    const [srcR, tgtR] = await Promise.all([
      warungFsFetch(`${base}/warung_products/${encodeURIComponent(sourceProductCode)}`),
      warungFsFetch(`${base}/warung_products/${encodeURIComponent(targetProductCode)}`),
    ]);
    if (!srcR.ok) return errorResponse("Produk source tidak ditemukan.", 404);
    if (!tgtR.ok) return errorResponse("Produk target tidak ditemukan.", 404);

    // Generate ID
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = await nextSequence("ip_" + ymd, 1);
    const txId = `IP-${ymd}-${String(seq).padStart(3, "0")}`;

    // Mutasi stok: source keluar (-), target masuk (+)
    await applyBatchStockMutations({
      mutations: [
        { productCode: sourceProductCode, signedQty: -sourceQty, notes: `IP ${txId} keluar` },
        { productCode: targetProductCode, signedQty: targetQty, notes: `IP ${txId} masuk` },
      ],
      type: "IP",
      refType: "ADJUSTMENT_IP",
      refId: txId,
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      allowNegative: false,
    });

    // Tulis dokumen IP
    const nowIso = new Date().toISOString();
    const payload = {
      fields: {
        txId: { stringValue: txId },
        sourceProductCode: { stringValue: sourceProductCode },
        sourceQty: { integerValue: String(sourceQty) },
        targetProductCode: { stringValue: targetProductCode },
        targetQty: { integerValue: String(targetQty) },
        notes: { stringValue: notes },
        createdAt: { timestampValue: nowIso },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(`${base}/warung_adjustment_ip/${encodeURIComponent(txId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) return errorResponse("Mutasi stok berhasil, gagal simpan dokumen IP.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_IP",
      entity: "warung_adjustment_ip",
      entityId: txId,
      after: { sourceProductCode, sourceQty, targetProductCode, targetQty },
    });

    return okResponse({ txId }, `Adjustment IP ${txId} berhasil.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}