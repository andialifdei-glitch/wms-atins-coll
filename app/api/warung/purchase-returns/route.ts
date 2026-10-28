import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { nextSequence } from "@/lib/warung/counters";
import { applyBatchStockMutations } from "@/lib/warung/stocks";

export const dynamic = "force-dynamic";

interface RtrItem { productCode: string; productName: string; qty: number; cost: number; subtotal: number; }

function docToRtr(d: any) {
  const f = d.fields || {};
  const raw = f.items?.arrayValue?.values || [];
  const items: RtrItem[] = raw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      productCode: m.productCode?.stringValue || "",
      productName: m.productName?.stringValue || "",
      qty: parseInt(m.qty?.integerValue || "0", 10),
      cost: parseInt(m.cost?.integerValue || "0", 10),
      subtotal: parseInt(m.subtotal?.integerValue || "0", 10),
    };
  });
  return {
    rtrId: f.rtrId?.stringValue || d.name.split("/").pop(),
    rcvId: f.rcvId?.stringValue || "",
    supplierCode: f.supplierCode?.stringValue || "",
    supplierName: f.supplierName?.stringValue || "",
    returnDate: f.returnDate?.stringValue || "",
    items,
    totalAmount: parseInt(f.totalAmount?.integerValue || "0", 10),
    reason: f.reason?.stringValue || "",
    notes: f.notes?.stringValue || "",
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_purchase_returns?pageSize=300`);
    if (!res.ok) return errorResponse("Gagal baca retur.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToRtr);
    if (q) items = items.filter((x: any) => x.rtrId.toLowerCase().includes(q) || x.supplierName.toLowerCase().includes(q) || x.rcvId.toLowerCase().includes(q));
    items.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
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
  const rcvId = String(body.rcvId || "").trim(); // OPSIONAL
  const returnDate = String(body.returnDate || "").trim() || new Date().toISOString().slice(0, 10);
  const reason = String(body.reason || "").trim();
  const notes = String(body.notes || "").trim();
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (rawItems.length === 0) return errorResponse("Minimal 1 item.");

  try {
    const base = warungDatastoreBase();

    // Kalau rcvId diisi, validasi & ambil supplier
    let supplierCode = "";
    let supplierName = "";
    if (rcvId) {
      const rcvRes = await warungFsFetch(`${base}/warung_receivings/${encodeURIComponent(rcvId)}`);
      if (!rcvRes.ok) return errorResponse("Receiving tidak ditemukan.", 400);
      const rj: any = await rcvRes.json();
      supplierCode = rj.fields?.supplierCode?.stringValue || "";
      supplierName = rj.fields?.supplierName?.stringValue || "";
    }

    const items: RtrItem[] = [];
    let totalAmount = 0;
    for (const it of rawItems) {
      const productCode = String(it.productCode || "").trim();
      const qty = Math.trunc(Number(it.qty || 0));
      const cost = Math.max(0, Math.trunc(Number(it.cost || 0)));
      if (!productCode || qty <= 0) return errorResponse("Item tidak valid: " + productCode);
      const prodRes = await warungFsFetch(`${base}/warung_products/${encodeURIComponent(productCode)}`);
      const pj: any = prodRes.ok ? await prodRes.json() : { fields: {} };
      const productName = pj.fields?.name?.stringValue || "";
      const subtotal = qty * cost;
      totalAmount += subtotal;
      items.push({ productCode, productName, qty, cost, subtotal });
    }

    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = await nextSequence("rtr_" + ymd, 1);
    const rtrId = `RTR-${ymd}-${String(seq).padStart(3, "0")}`;

    // Mutasi stok keluar (OUT) — allowNegative=true sesuai keputusan
    await applyBatchStockMutations({
      mutations: items.map((it) => ({ productCode: it.productCode, signedQty: -Math.abs(it.qty), cost: it.cost, notes: `Retur ${rtrId}` })),
      type: "OUT",
      refType: "PURCHASE_RETURN",
      refId: rtrId,
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      allowNegative: true,
    });

    const itemsArrayValues = items.map((it) => ({
      mapValue: {
        fields: {
          productCode: { stringValue: it.productCode },
          productName: { stringValue: it.productName },
          qty: { integerValue: String(it.qty) },
          cost: { integerValue: String(it.cost) },
          subtotal: { integerValue: String(it.subtotal) },
        },
      },
    }));

    const payload = {
      fields: {
        rtrId: { stringValue: rtrId },
        rcvId: { stringValue: rcvId },
        supplierCode: { stringValue: supplierCode },
        supplierName: { stringValue: supplierName },
        returnDate: { stringValue: returnDate },
        items: { arrayValue: { values: itemsArrayValues } },
        totalAmount: { integerValue: String(totalAmount) },
        reason: { stringValue: reason },
        notes: { stringValue: notes },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const fsUrl = `${base}/warung_purchase_returns/${encodeURIComponent(rtrId)}`;
    const res = await warungFsFetch(fsUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Stok keluar sudah, gagal tulis retur. Cek manual.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_RETURN",
      entity: "warung_purchase_returns",
      entityId: rtrId,
      after: { rtrId, rcvId, totalAmount, itemCount: items.length },
    });

    return okResponse({ rtrId, totalAmount, itemCount: items.length }, `Retur ${rtrId} berhasil.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}