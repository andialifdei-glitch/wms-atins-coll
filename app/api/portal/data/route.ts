import { NextRequest, NextResponse } from "next/server";
import { verifyServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

async function fetchCollection(collectionName: string, apiKey: string, limitCount = 300) {
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${apiKey}`;
  const res = await fetch(queryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        limit: limitCount,
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const list: any[] = await res.json();
  return list
    .filter((d) => d.document && d.document.fields)
    .map((d) => {
      const fields = d.document.fields;
      const parsed: any = { id: d.document.name.split("/").pop() };
      for (const key of Object.keys(fields)) {
        const val = fields[key];
        if (val.stringValue !== undefined) parsed[key] = val.stringValue;
        else if (val.integerValue !== undefined) parsed[key] = Number(val.integerValue);
        else if (val.doubleValue !== undefined) parsed[key] = Number(val.doubleValue);
        else if (val.booleanValue !== undefined) parsed[key] = val.booleanValue;
        else if (val.timestampValue !== undefined) parsed[key] = val.timestampValue;
        else if (val.arrayValue !== undefined) parsed[key] = val.arrayValue.values || [];
      }
      return parsed;
    });
}

export async function GET(request: NextRequest) {
  const user = await verifyServerSession(request);
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak. Sesi tidak sah." }, { status: 401 });
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  const isRoot = user.role === "ROOT_ADMIN";

  try {
    const [rawProducts, families, customers, salesOrders, deliveryOrders, purchaseOrders, receivings, stockOpnames, stockAdjustments, stockMovements] = await Promise.all([
      fetchCollection("products", apiKey, 500),
      fetchCollection("families", apiKey, 100),
      fetchCollection("customers", apiKey, 300),
      fetchCollection("sales_orders", apiKey, 200),
      fetchCollection("delivery_orders", apiKey, 200),
      fetchCollection("purchase_orders", apiKey, 100),
      fetchCollection("receivings", apiKey, 100),
      fetchCollection("stock_opnames", apiKey, 100),
      fetchCollection("stock_adjustments", apiKey, 100),
      fetchCollection("stock_movements", apiKey, 300),
    ]);

    // Data Minimization: Sembunyikan HPP (purchasingPrice) dari non-ROOT_ADMIN
    const sanitizedProducts = rawProducts.map((p: any) => {
      if (!isRoot) {
        const { purchasingPrice, ...safeProduct } = p;
        return safeProduct;
      }
      return p;
    });

    let usersList: any[] = [];
    let settingsList: any[] = [];
    let suppliersList: any[] = [];

    if (isRoot) {
      [usersList, settingsList, suppliersList] = await Promise.all([
        fetchCollection("users", apiKey, 100),
        fetchCollection("settings", apiKey, 10),
        fetchCollection("suppliers", apiKey, 200),
      ]);
    } else {
      suppliersList = await fetchCollection("suppliers", apiKey, 200);
      usersList = [{ id: user.id, uid: user.uid, fullName: user.name, role: user.role }];
    }

    return NextResponse.json({
      success: true,
      data: {
        products: sanitizedProducts,
        families,
        customers,
        salesOrders,
        deliveryOrders,
        purchaseOrders,
        receivings,
        stockOpnames,
        stockAdjustments,
        stockMovements,
        users: usersList,
        settings: settingsList,
        suppliers: suppliersList,
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Gagal memproses data portal." }, { status: 500 });
  }
}