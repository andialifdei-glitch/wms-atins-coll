import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { nextSequence } from "@/lib/warung/counters";

export const dynamic = "force-dynamic";

function docToOpname(d: any) {
  const f = d.fields || {};
  return {
    opnameId: f.opnameId?.stringValue || d.name.split("/").pop(),
    status: f.status?.stringValue || "DRAFT",
    snapshotAt: f.snapshotAt?.timestampValue || "",
    reviewedBy: f.reviewedBy?.stringValue || "",
    postedBy: f.postedBy?.stringValue || "",
    totalItems: parseInt(f.totalItems?.integerValue || "0", 10),
    totalDiffValue: parseInt(f.totalDiffValue?.integerValue || "0", 10),
    notes: f.notes?.stringValue || "",
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") || "").trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_stock_opnames?pageSize=200`);
    if (!res.ok) return errorResponse("Gagal baca opname.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToOpname);
    if (status) items = items.filter((x: any) => x.status === status);
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
  const notes = String(body.notes || "").trim();

  try {
    const base = warungDatastoreBase();

    // Ambil semua produk untuk snapshot
    const prodRes = await warungFsFetch(`${base}/warung_products?pageSize=500`);
    let prods: any[] = [];
    if (prodRes.ok) {
      const pj: any = await prodRes.json();
      prods = (pj.documents || []).map((d: any) => ({
        productCode: d.name.split("/").pop(),
        name: d.fields?.name?.stringValue || "",
        active: d.fields?.active?.booleanValue ?? true,
        stockCategory: d.fields?.stockCategory?.stringValue || "FISIK",
        capitalPrice: parseInt(d.fields?.capitalPrice?.integerValue || "0", 10),
      })).filter((p: any) => p.active && p.stockCategory === "FISIK");
    }
    if (prods.length === 0) return errorResponse("Tidak ada produk aktif FISIK untuk diopname.", 400);

    // Ambil stok
    const stRes = await warungFsFetch(`${base}/warung_stocks?pageSize=500`);
    const stockMap: Record<string, number> = {};
    if (stRes.ok) {
      const sj: any = await stRes.json();
      (sj.documents || []).forEach((d: any) => {
        stockMap[d.name.split("/").pop()] = parseInt(d.fields?.qty?.integerValue || "0", 10);
      });
    }

    // Generate opnameId
    const seq = await nextSequence("sop_" + new Date().toISOString().slice(0, 10).replace(/-/g, ""), 1);
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const opnameId = `SOP-${ymd}-${String(seq).padStart(3, "0")}`;

    // Tulis header
    const headerPayload = {
      fields: {
        opnameId: { stringValue: opnameId },
        status: { stringValue: "DRAFT" },
        snapshotAt: { timestampValue: new Date().toISOString() },
        totalItems: { integerValue: String(prods.length) },
        totalDiffValue: { integerValue: "0" },
        notes: { stringValue: notes },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const headerRes = await warungFsFetch(`${base}/warung_stock_opnames/${encodeURIComponent(opnameId)}`, {
      method: "PATCH",
      body: JSON.stringify(headerPayload),
    });
    if (!headerRes.ok) return errorResponse("Gagal buat header opname.", 500);

    // Tulis items (satu per produk)
    for (const p of prods) {
      const systemQty = stockMap[p.productCode] ?? 0;
      const itemId = `${opnameId}_${p.productCode}`;
      const itemPayload = {
        fields: {
          opnameId: { stringValue: opnameId },
          productCode: { stringValue: p.productCode },
          productName: { stringValue: p.name },
          systemQty: { integerValue: String(systemQty) },
          physicalQty: { integerValue: String(systemQty) },
          diffQty: { integerValue: "0" },
          cost: { integerValue: String(p.capitalPrice) },
          diffValue: { integerValue: "0" },
        },
      };
      await warungFsFetch(`${base}/warung_stock_opnames_items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify(itemPayload),
      });
    }

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_OPNAME",
      entity: "warung_stock_opnames",
      entityId: opnameId,
      after: { opnameId, totalItems: prods.length },
    });

    return okResponse({ opnameId, totalItems: prods.length }, `Opname ${opnameId} dibuat (${prods.length} item).`);
  } catch (e: any) {
    console.error("[stock-opname POST]", e.message);
    return errorResponse(e.message, 500);
  }
}