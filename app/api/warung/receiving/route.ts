import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { nextSequence } from "@/lib/warung/counters";
import { applyBatchStockMutations } from "@/lib/warung/stocks";

export const dynamic = "force-dynamic";

interface RcvItem {
  productCode: string;
  productName: string;
  qtyOrdered: number;
  qtyReceived: number;
  cost: number;
  subtotal: number;
}

function docToRcv(d: any) {
  const f = d.fields || {};
  const itemsRaw = f.items?.arrayValue?.values || [];
  const items: RcvItem[] = itemsRaw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      productCode: m.productCode?.stringValue || "",
      productName: m.productName?.stringValue || "",
      qtyOrdered: parseInt(m.qtyOrdered?.integerValue || "0", 10),
      qtyReceived: parseInt(m.qtyReceived?.integerValue || "0", 10),
      cost: parseInt(m.cost?.integerValue || "0", 10),
      subtotal: parseInt(m.subtotal?.integerValue || "0", 10),
    };
  });
  return {
    rcvId: f.rcvId?.stringValue || d.name.split("/").pop(),
    poId: f.poId?.stringValue || "",
    supplierCode: f.supplierCode?.stringValue || "",
    supplierName: f.supplierName?.stringValue || "",
    receiveDate: f.receiveDate?.stringValue || "",
    status: f.status?.stringValue || "POSTED",
    items,
    totalAmount: parseInt(f.totalAmount?.integerValue || "0", 10),
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
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_receivings?pageSize=300`);
    if (!res.ok) return errorResponse("Gagal baca receiving.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToRcv);
    if (q) items = items.filter((x: any) => x.rcvId.toLowerCase().includes(q) || x.poId.toLowerCase().includes(q) || x.supplierName.toLowerCase().includes(q));
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
  const poId = String(body.poId || "").trim();
  const receiveDate = String(body.receiveDate || "").trim() || new Date().toISOString().slice(0, 10);
  const notes = String(body.notes || "").trim();
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!poId) return errorResponse("PO wajib dipilih.");
  if (rawItems.length === 0) return errorResponse("Minimal 1 item.");

  try {
    const base = warungDatastoreBase();
    const poRes = await warungFsFetch(`${base}/warung_po/${encodeURIComponent(poId)}`);
    if (!poRes.ok) return errorResponse("PO tidak ditemukan.", 404);
    const poj: any = await poRes.json();
    const poStatus = poj.fields?.status?.stringValue || "";
    if (poStatus === "RECEIVED") return errorResponse("PO sudah RECEIVED.", 400);
    if (poStatus === "CANCELLED") return errorResponse("PO sudah CANCELLED.", 400);
    const supplierCode = poj.fields?.supplierCode?.stringValue || "";
    const supplierName = poj.fields?.supplierName?.stringValue || "";

    const items: RcvItem[] = [];
    let totalAmount = 0;
    for (const it of rawItems) {
      const productCode = String(it.productCode || "").trim();
      const qtyOrdered = Math.trunc(Number(it.qtyOrdered || 0));
      const qtyReceived = Math.trunc(Number(it.qtyReceived || 0));
      const cost = Math.max(0, Math.trunc(Number(it.cost || 0)));
      if (!productCode || qtyReceived <= 0) return errorResponse("Item tidak valid: " + productCode);
      const subtotal = qtyReceived * cost;
      totalAmount += subtotal;
      const prodRes = await warungFsFetch(`${base}/warung_products/${encodeURIComponent(productCode)}`);
      const pj: any = prodRes.ok ? await prodRes.json() : { fields: {} };
      items.push({
        productCode,
        productName: pj.fields?.name?.stringValue || "",
        qtyOrdered,
        qtyReceived,
        cost,
        subtotal,
      });
    }

    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const seq = await nextSequence("rcv_" + ymd, 1);
    const rcvId = `RCV-${ymd}-${String(seq).padStart(3, "0")}`;

    // Mutasi stok masuk (IN) — atomic
    await applyBatchStockMutations({
      mutations: items.map((it) => ({ productCode: it.productCode, signedQty: it.qtyReceived, cost: it.cost, notes: `RCV ${rcvId} masuk` })),
      type: "IN",
      refType: "RECEIVING",
      refId: rcvId,
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      allowNegative: true,
    });

    const itemsArrayValues = items.map((it) => ({
      mapValue: {
        fields: {
          productCode: { stringValue: it.productCode },
          productName: { stringValue: it.productName },
          qtyOrdered: { integerValue: String(it.qtyOrdered) },
          qtyReceived: { integerValue: String(it.qtyReceived) },
          cost: { integerValue: String(it.cost) },
          subtotal: { integerValue: String(it.subtotal) },
        },
      },
    }));

    const payload = {
      fields: {
        rcvId: { stringValue: rcvId },
        poId: { stringValue: poId },
        supplierCode: { stringValue: supplierCode },
        supplierName: { stringValue: supplierName },
        receiveDate: { stringValue: receiveDate },
        status: { stringValue: "POSTED" },
        items: { arrayValue: { values: itemsArrayValues } },
        totalAmount: { integerValue: String(totalAmount) },
        notes: { stringValue: notes },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const fsUrl = `${base}/warung_receivings/${encodeURIComponent(rcvId)}`;
    const res = await warungFsFetch(fsUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Stok terlanjur masuk, gagal tulis receiving. Cek manual.", 500);

    // Update PO status RECEIVED (selalu selesai — sesuai keputusan)
    const poMask = "updateMask.fieldPaths=status&updateMask.fieldPaths=receivedAt&updateMask.fieldPaths=receivedBy";
    await warungFsFetch(`${base}/warung_po/${encodeURIComponent(poId)}?${poMask}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { status: { stringValue: "RECEIVED" }, receivedAt: { timestampValue: new Date().toISOString() }, receivedBy: { stringValue: user.id } } }),
    });

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_RECEIVING",
      entity: "warung_receivings",
      entityId: rcvId,
      after: { rcvId, poId, totalAmount, itemCount: items.length },
    });

    return okResponse({ rcvId, totalAmount, itemCount: items.length }, `Receiving ${rcvId} berhasil. PO ${poId} selesai.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}