import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { generateProductCode } from "@/lib/warung/products";

export const dynamic = "force-dynamic";

interface ProductDTO {
  productCode: string;
  famCode: string;
  divCode: string;
  deptCode: string;
  familyCodeLocal: string;
  familyName: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  stockCategory: string;
  capitalPrice: number;
  sellingPrice: number;
  minStock: number;
  active: boolean;
  notes: string;
}

function docToProduct(d: any): ProductDTO {
  const f = d.fields || {};
  return {
    productCode: f.productCode?.stringValue || "",
    famCode: f.famCode?.stringValue || "",
    divCode: f.divCode?.stringValue || "",
    deptCode: f.deptCode?.stringValue || "",
    familyCodeLocal: f.familyCodeLocal?.stringValue || "",
    familyName: f.familyName?.stringValue || "",
    name: f.name?.stringValue || "",
    sku: f.sku?.stringValue || "",
    barcode: f.barcode?.stringValue || "",
    unit: f.unit?.stringValue || "Pcs",
    stockCategory: f.stockCategory?.stringValue || "FISIK",
    capitalPrice: parseInt(f.capitalPrice?.integerValue || "0", 10),
    sellingPrice: parseInt(f.sellingPrice?.integerValue || "0", 10),
    minStock: parseInt(f.minStock?.integerValue || "0", 10),
    active: f.active?.booleanValue ?? true,
    notes: f.notes?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const famCode = (searchParams.get("famCode") || "").trim();
  const activeOnly = searchParams.get("active") === "true";

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_products?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal membaca produk.", 500);
    const data: any = await res.json();
    let items: ProductDTO[] = (data.documents || []).map(docToProduct);
    if (famCode) items = items.filter((p) => p.famCode === famCode);
    if (q) items = items.filter((p) =>
      p.productCode.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q)
    );
    if (activeOnly) items = items.filter((p) => p.active);
    items.sort((a, b) => a.productCode.localeCompare(b.productCode));
    return okResponse(items);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse("Hanya Admin Warung.");

  const body = await request.json().catch(() => ({}));
  const famCode = String(body.famCode || "").trim();
  const name = String(body.name || "").trim();
  const sku = String(body.sku || "").trim();
  const barcode = String(body.barcode || "").trim();
  const unit = String(body.unit || "Pcs").trim() || "Pcs";
  const stockCategory = String(body.stockCategory || "FISIK").trim() === "JASA" ? "JASA" : "FISIK";
  const capitalPrice = Math.max(0, Math.floor(Number(body.capitalPrice || 0)));
  const sellingPrice = Math.max(0, Math.floor(Number(body.sellingPrice || 0)));
  const minStock = Math.floor(Number(body.minStock || 0)); // boleh negatif? tidak, minimal 0
  const notes = String(body.notes || "").trim();

  if (!famCode) return errorResponse("Family wajib dipilih.");
  if (!name) return errorResponse("Nama produk wajib diisi.");

  try {
    const base = warungDatastoreBase();

    // Verifikasi family ada
    const famRes = await warungFsFetch(`${base}/warung_families/${encodeURIComponent(famCode)}`);
    if (!famRes.ok) return errorResponse("Family tidak ditemukan.", 400);
    const famData: any = await famRes.json();
    if ((famData.fields?.active?.booleanValue ?? true) === false) {
      return errorResponse("Family tidak aktif.", 400);
    }
    const divCode = famData.fields?.divCode?.stringValue || "";
    const deptCode = famData.fields?.deptCode?.stringValue || "";
    const familyCodeLocal = famData.fields?.familyCodeLocal?.stringValue || "";
    const familyName = famData.fields?.familyName?.stringValue || "";

    // Cek SKU unik
    if (sku) {
      const listRes = await warungFsFetch(`${base}/warung_products?pageSize=500`);
      if (listRes.ok) {
        const listData: any = await listRes.json();
        const exists = (listData.documents || []).some((d: any) => d.fields?.sku?.stringValue === sku);
        if (exists) return errorResponse(`SKU "${sku}" sudah dipakai produk lain.`, 409);
      }
    }

    // Generate productCode
    const productCode = await generateProductCode(famCode);

    const docUrl = `${base}/warung_products/${encodeURIComponent(productCode)}`;
    const payload = {
      fields: {
        productCode: { stringValue: productCode },
        famCode: { stringValue: famCode },
        divCode: { stringValue: divCode },
        deptCode: { stringValue: deptCode },
        familyCodeLocal: { stringValue: familyCodeLocal },
        familyName: { stringValue: familyName },
        name: { stringValue: name },
        sku: { stringValue: sku },
        barcode: { stringValue: barcode },
        unit: { stringValue: unit },
        stockCategory: { stringValue: stockCategory },
        capitalPrice: { integerValue: String(capitalPrice) },
        sellingPrice: { integerValue: String(sellingPrice) },
        minStock: { integerValue: String(minStock) },
        active: { booleanValue: true },
        notes: { stringValue: notes },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(docUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) {
      const txt = await res.text();
      return errorResponse("Gagal menyimpan produk.", 500, { detail: txt.slice(0, 300) });
    }

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_PRODUCT",
      entity: "warung_products",
      entityId: productCode,
      after: { productCode, famCode, name, sku },
    });

    return okResponse({ productCode, name }, `Produk ${productCode} berhasil dibuat.`);
  } catch (e: any) {
    console.error("[products POST]", e.message);
    return errorResponse(e.message, 500);
  }
}