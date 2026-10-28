import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { voidSale } from "@/lib/warung/pos";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ saleId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  const { saleId } = await ctx.params;
  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_sales/${encodeURIComponent(saleId)}`);
    if (!res.ok) return notFoundResponse("Penjualan tidak ditemukan.");
    const j: any = await res.json();
    const f = j.fields || {};
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
    return okResponse({
      saleId: f.saleId?.stringValue || saleId,
      saleDate: f.saleDate?.stringValue || "",
      customerName: f.customerName?.stringValue || "",
      paymentMethod: f.paymentMethod?.stringValue || "CASH",
      subtotal: parseInt(f.subtotal?.integerValue || "0", 10),
      totalAmount: parseInt(f.totalAmount?.integerValue || "0", 10),
      items,
      saleJournalId: f.saleJournalId?.stringValue || "",
      cogsJournalId: f.cogsJournalId?.stringValue || "",
      receivableId: f.receivableId?.stringValue || "",
      cashFlowId: f.cashFlowId?.stringValue || "",
      status: f.status?.stringValue || "POSTED",
      notes: f.notes?.stringValue || "",
      createdAt: f.createdAt?.timestampValue || "",
      createdBy: f.createdBy?.stringValue || "",
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ saleId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { saleId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();

  if (action !== "VOID") return errorResponse("action harus VOID.", 400);

  try {
    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    const result = await voidSale(saleId, actor);
    await writeAuditLog({ actor, action: "VOID_SALE", entity: "warung_sales", entityId: saleId });
    await logActivity({ category: "JOURNAL", action: "VOID", entityId: saleId, entityLabel: `VOID Penjualan ${saleId}`, journalId: result.voidJournalId, actor });
    return okResponse({ saleId, voidJournalId: result.voidJournalId }, "Penjualan di-void.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}