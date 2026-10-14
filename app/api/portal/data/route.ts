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
  if ("arrayValue" in v) {
    return (v.arrayValue.values || []).map(unwrapValue);
  }
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

async function fetchCollection(colName: string, limitCount = 500, apiKey: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${apiKey}`;
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
  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    "";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const [
    products,
    families,
    customers,
    salesOrders,
    deliveryOrders,
    purchaseOrders,
    receivings,
    stockOpnames,
    stockAdjustments,
    stockMovements,
    settings,
    users
  ] = await Promise.all([
    fetchCollection("products", 500, apiKey),
    fetchCollection("families", 100, apiKey),
    fetchCollection("customers", 300, apiKey),
    fetchCollection("sales_orders", 200, apiKey),
    fetchCollection("delivery_orders", 200, apiKey),
    fetchCollection("purchase_orders", 100, apiKey),
    fetchCollection("receivings", 100, apiKey),
    fetchCollection("stock_opnames", 100, apiKey),
    fetchCollection("stock_adjustments", 100, apiKey),
    fetchCollection("stock_movements", 300, apiKey),
    fetchCollection("settings", 10, apiKey),
    fetchCollection("users", 100, apiKey)
  ]);

  return NextResponse.json({
    success: true,
    data: {
      products,
      families,
      customers,
      salesOrders,
      deliveryOrders,
      purchaseOrders,
      receivings,
      stockOpnames,
      stockAdjustments,
      stockMovements,
      settings,
      users
    }
  });
}