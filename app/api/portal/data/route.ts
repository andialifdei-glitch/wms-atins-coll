import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

function unwrapValue(v: any): any {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(unwrapValue);
  if ("mapValue" in v) {
    const obj: any = {};
    for (const [mk, mv] of Object.entries(v.mapValue.fields || {})) {
      obj[mk] = unwrapValue(mv);
    }
    return obj;
  }
  return v;
}

function parseDoc(doc: any) {
  if (!doc) return null;
  const id = doc.name ? doc.name.split("/").pop() : "";
  const data: any = { id };
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      data[k] = unwrapValue(v);
    }
  }
  return data;
}

async function fetchCollection(colName: string, limitCount = 500, key: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${key}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: colName }],
          limit: limitCount
        }
      })
    });
    if (!res.ok) return [];
    const list: any[] = await res.json();
    return list.filter((item) => item.document).map((item) => parseDoc(item.document));
  } catch {
    return [];
  }
}

export async function GET() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB04dGkGOXRV8gCOlrWoPKaPm8pUHxmS9w";
  const [
    products, families, customers, salesOrders, deliveryOrders,
    purchaseOrders, receivings, stockOpnames, stockAdjustments,
    stockMovements, settings, users
  ] = await Promise.all([
    fetchCollection("products", 500, key),
    fetchCollection("families", 100, key),
    fetchCollection("customers", 300, key),
    fetchCollection("sales_orders", 200, key),
    fetchCollection("delivery_orders", 200, key),
    fetchCollection("purchase_orders", 100, key),
    fetchCollection("receivings", 100, key),
    fetchCollection("stock_opnames", 100, key),
    fetchCollection("stock_adjustments", 100, key),
    fetchCollection("stock_movements", 300, key),
    fetchCollection("settings", 10, key),
    fetchCollection("users", 100, key)
  ]);

  return NextResponse.json({
    success: true,
    data: {
      products, families, customers, salesOrders, deliveryOrders,
      purchaseOrders, receivings, stockOpnames, stockAdjustments,
      stockMovements, settings, users
    }
  });
}