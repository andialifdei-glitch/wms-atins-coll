import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { postSale, type PaymentMethod } from "@/lib/warung/pos";

export const dynamic = "force-dynamic";

function docToSale(d: any) {
  const f = d.fields || {};
  const itemsRaw = f.items?.arrayValue?.values || [];
  const items = itemsRaw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      productCode: m.productCode?.stringValue || "",
      productName: m.productName?.stringValue || "",
      unit: m.unit?.stringValue || "",
      capitalPrice: parseInt(m.capitalPrice?.integerValue || "0", 10),
      sellingPrice: parseInt(m.sellingPrice?.integerValue || "0", 10),
      qty: parseInt(m.qty?.integerValue || "0", 10),
      discountItem: parseInt(m.discountItem?.integerValue || "0", 10),
      subtotal: parseInt(m.subtotal?.integerValue || "0", 10),
    };
  });
  return {
    saleId: f.saleId?.stringValue || d.name.split("/").pop(),
    saleDate: f.saleDate?.stringValue || "",
    customerName: f.customerName?.stringValue || "",
    paymentMethod: f.paymentMethod?.stringValue || "CASH",
    subtotal: parseInt(f.subtotal?.integerValue || "0", 10),
    discountAmount: parseInt(f.discountAmount?.integerValue || "0", 10),
    totalAmount: parseInt(f.totalAmount?.integerValue || "0", 10),
    paidAmount: parseInt(f.paidAmount?.integerValue || "0", 10),
    remainingAmount: parseInt(f.remainingAmount?.integerValue || "0", 10),
    items,
    saleJournalId: f.saleJournalId?.stringValue || "",
    cogsJournalId: f.cogsJournalId?.stringValue || "",
    receivableId: f.receivableId?.stringValue || "",
    cashFlowId: f.cashFlowId?.stringValue || "",
    status: f.status?.stringValue || "POSTED",
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
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const status = (searchParams.get("status") || "").trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_sales?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal baca penjualan.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToSale);
    if (q) items = items.filter((x: any) => x.saleId.toLowerCase().includes(q) || x.customerName.toLowerCase().includes(q));
    if (from) items = items.filter((x: any) => x.saleDate >= from);
    if (to) items = items.filter((x: any) => x.saleDate <= to);
    if (status) items = items.filter((x: any) => x.status === status);
    items.sort((a: any, b: any) => String(b.saleDate).localeCompare(String(a.saleDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
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
  const saleDate = String(body.saleDate || "").trim() || new Date().toISOString().slice(0, 10);
  const customerName = String(body.customerName || "").trim() || "Walk-in";
  const customerId = String(body.customerId || "").trim();
  const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase() as PaymentMethod;
  const notes = String(body.notes || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) return errorResponse("Tidak ada item.");
  if (paymentMethod !== "CASH" && paymentMethod !== "CREDIT") return errorResponse("paymentMethod harus CASH atau CREDIT.");

  try {
    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    const result = await postSale({
      saleDate, customerName, customerId, paymentMethod, items, notes, actor,
    });

    await writeAuditLog({ actor, action: "CREATE_SALE", entity: "warung_sales", entityId: result.saleId, after: { saleId: result.saleId, total: result.totalAmount, paymentMethod } });
    await logActivity({
      category: "JOURNAL",
      action: "CREATE",
      entityId: result.saleId,
      entityLabel: `Penjualan ${result.saleId} ${paymentMethod} — ${customerName}`,
      amount: result.totalAmount,
      journalId: result.saleJournalId,
      actor,
      notes,
    });

    return okResponse({
      saleId: result.saleId,
      totalAmount: result.totalAmount,
      saleJournalId: result.saleJournalId,
      cogsJournalId: result.cogsJournalId,
      cashFlowId: result.cashFlowId,
      receivableId: result.receivableId,
    }, `Penjualan ${result.saleId} berhasil.`);
  } catch (e: any) {
    console.error("[sales POST]", e.message);
    return errorResponse(e.message, 500);
  }
}