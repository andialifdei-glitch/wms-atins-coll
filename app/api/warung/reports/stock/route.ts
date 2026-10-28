import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const lowOnly = searchParams.get("lowOnly") === "true";

  try {
    const base = warungDatastoreBase();
    const [prodRes, stRes] = await Promise.all([
      warungFsFetch(`${base}/warung_products?pageSize=500`),
      warungFsFetch(`${base}/warung_stocks?pageSize=500`),
    ]);
    const prodMap: Record<string, any> = {};
    if (prodRes.ok) {
      const pj: any = await prodRes.json();
      (pj.documents || []).forEach((d: any) => {
        const code = d.name.split("/").pop();
        prodMap[code] = {
          name: d.fields?.name?.stringValue || "",
          unit: d.fields?.unit?.stringValue || "",
          minStock: parseInt(d.fields?.minStock?.integerValue || "0", 10),
          capitalPrice: parseInt(d.fields?.capitalPrice?.integerValue || "0", 10),
        };
      });
    }

    const stockMap: Record<string, number> = {};
    if (stRes.ok) {
      const sj: any = await stRes.json();
      (sj.documents || []).forEach((d: any) => {
        stockMap[d.name.split("/").pop()] = parseInt(d.fields?.qty?.integerValue || "0", 10);
      });
    }

    let rows = Object.keys(prodMap).map((code) => {
      const p = prodMap[code];
      const qty = stockMap[code] || 0;
      return {
        productCode: code,
        productName: p.name,
        unit: p.unit,
        qty,
        minStock: p.minStock,
        capitalPrice: p.capitalPrice,
        value: qty * p.capitalPrice,
        low: qty <= p.minStock,
      };
    });

    if (q) rows = rows.filter((r) => r.productCode.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q));
    if (lowOnly) rows = rows.filter((r) => r.low);
    rows.sort((a, b) => a.productCode.localeCompare(b.productCode));

    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    const totalValue = rows.reduce((s, r) => s + r.value, 0);

    return okResponse({ rows, totalQty, totalValue, itemCount: rows.length });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}