import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  const { code } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "200", 10)));

  try {
    const base = warungDatastoreBase();
    const res = await warungFsFetch(`${base}/warung_stock_movements?pageSize=${limit}`);
    if (!res.ok) return errorResponse("Gagal baca movements.", 500);
    const j: any = await res.json();
    const docs = (j.documents || []).filter((d: any) => d.fields?.productCode?.stringValue === code);
    const items = docs.map((d: any) => {
      const f = d.fields || {};
      return {
        docId: f.docId?.stringValue || d.name.split("/").pop(),
        productCode: f.productCode?.stringValue || "",
        type: f.type?.stringValue || "",
        qty: parseInt(f.qty?.integerValue || "0", 10),
        balanceBefore: parseInt(f.balanceBefore?.integerValue || "0", 10),
        balanceAfter: parseInt(f.balanceAfter?.integerValue || "0", 10),
        refType: f.refType?.stringValue || "",
        refId: f.refId?.stringValue || "",
        cost: parseInt(f.cost?.integerValue || "0", 10),
        notes: f.notes?.stringValue || "",
        actorName: f.actorName?.stringValue || "",
        createdAt: f.createdAt?.timestampValue || "",
      };
    });
    items.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return okResponse(items);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}