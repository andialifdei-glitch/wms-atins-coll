import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, notFoundResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  const { code } = await ctx.params;
  if (!code) return errorResponse("code tidak valid.");

  try {
    const base = warungDatastoreBase();
    const [stRes, prodRes] = await Promise.all([
      warungFsFetch(`${base}/warung_stocks/${encodeURIComponent(code)}`),
      warungFsFetch(`${base}/warung_products/${encodeURIComponent(code)}`),
    ]);

    let qty = 0;
    let lastMovementAt = "";
    if (stRes.ok) {
      const j: any = await stRes.json();
      qty = parseInt(j.fields?.qty?.integerValue || "0", 10);
      lastMovementAt = j.fields?.lastMovementAt?.timestampValue || "";
    }

    let productName = "";
    let minStock = 0;
    let unit = "";
    if (prodRes.ok) {
      const pj: any = await prodRes.json();
      productName = pj.fields?.name?.stringValue || "";
      minStock = parseInt(pj.fields?.minStock?.integerValue || "0", 10);
      unit = pj.fields?.unit?.stringValue || "";
    } else {
      return notFoundResponse("Produk tidak ditemukan.");
    }

    return okResponse({ productCode: code, qty, lastMovementAt, productName, minStock, unit, low: qty <= minStock });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}