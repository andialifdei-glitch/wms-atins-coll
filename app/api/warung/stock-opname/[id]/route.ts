import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { applyBatchStockMutations } from "@/lib/warung/stocks";

export const dynamic = "force-dynamic";

function docToItem(d: any) {
  const f = d.fields || {};
  return {
    itemId: d.name.split("/").pop(),
    opnameId: f.opnameId?.stringValue || "",
    productCode: f.productCode?.stringValue || "",
    productName: f.productName?.stringValue || "",
    systemQty: parseInt(f.systemQty?.integerValue || "0", 10),
    physicalQty: parseInt(f.physicalQty?.integerValue || "0", 10),
    diffQty: parseInt(f.diffQty?.integerValue || "0", 10),
    cost: parseInt(f.cost?.integerValue || "0", 10),
    diffValue: parseInt(f.diffValue?.integerValue || "0", 10),
  };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  const { id } = await ctx.params;
  if (!id) return errorResponse("id tidak valid.");

  try {
    const base = warungDatastoreBase();
    const headRes = await warungFsFetch(`${base}/warung_stock_opnames/${encodeURIComponent(id)}`);
    if (!headRes.ok) return notFoundResponse("Opname tidak ditemukan.");
    const headJ: any = await headRes.json();
    const head = {
      opnameId: headJ.fields?.opnameId?.stringValue || id,
      status: headJ.fields?.status?.stringValue || "DRAFT",
      snapshotAt: headJ.fields?.snapshotAt?.timestampValue || "",
      reviewedBy: headJ.fields?.reviewedBy?.stringValue || "",
      postedBy: headJ.fields?.postedBy?.stringValue || "",
      totalItems: parseInt(headJ.fields?.totalItems?.integerValue || "0", 10),
      totalDiffValue: parseInt(headJ.fields?.totalDiffValue?.integerValue || "0", 10),
      notes: headJ.fields?.notes?.stringValue || "",
      createdAt: headJ.fields?.createdAt?.timestampValue || "",
      createdBy: headJ.fields?.createdBy?.stringValue || "",
    };

    const itemsRes = await warungFsFetch(`${base}/warung_stock_opnames_items?pageSize=1000`);
    let items: any[] = [];
    if (itemsRes.ok) {
      const ij: any = await itemsRes.json();
      items = (ij.documents || []).map(docToItem).filter((it: any) => it.opnameId === id);
      items.sort((a: any, b: any) => a.productCode.localeCompare(b.productCode));
    }

    return okResponse({ head, items });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase(); // "REVIEW" | "POST" | "CANCEL"
  const notes = body.notes !== undefined ? String(body.notes).trim() : undefined;

  try {
    const base = warungDatastoreBase();
    const headUrl = `${base}/warung_stock_opnames/${encodeURIComponent(id)}`;
    const headRes = await warungFsFetch(headUrl);
    if (!headRes.ok) return notFoundResponse("Opname tidak ditemukan.");
    const headJ: any = await headRes.json();
    const currentStatus = headJ.fields?.status?.stringValue || "DRAFT";

    if (action === "REVIEW") {
      if (currentStatus !== "DRAFT") return errorResponse("Hanya DRAFT bisa REVIEW.", 400);
      const mask = "updateMask.fieldPaths=status&updateMask.fieldPaths=reviewedBy&updateMask.fieldPaths=reviewedAt";
      const res = await warungFsFetch(`${headUrl}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { status: { stringValue: "REVIEW" }, reviewedBy: { stringValue: user.id }, reviewedAt: { timestampValue: new Date().toISOString() } } }),
      });
      if (!res.ok) return errorResponse("Gagal REVIEW.", 500);
      await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "REVIEW_OPNAME", entity: "warung_stock_opnames", entityId: id });
      return okResponse({ opnameId: id, status: "REVIEW" }, "Opname dipindah ke REVIEW.");
    }

    if (action === "POST") {
      if (currentStatus !== "REVIEW" && currentStatus !== "DRAFT") return errorResponse("Hanya DRAFT/REVIEW bisa POST.", 400);
      // Ambil items
      const itemsRes = await warungFsFetch(`${base}/warung_stock_opnames_items?pageSize=1000`);
      if (!itemsRes.ok) return errorResponse("Gagal baca items.", 500);
      const ij: any = await itemsRes.json();
      const items = (ij.documents || []).map(docToItem).filter((it: any) => it.opnameId === id);
      if (items.length === 0) return errorResponse("Opname tidak punya item.", 400);

      // Mutasi = physicalQty - systemQty (signed). Untuk SOP: tidak boleh negatif.
      const mutations = items
        .filter((it: any) => it.diffQty !== 0)
        .map((it: any) => ({
          productCode: it.productCode,
          signedQty: it.diffQty,
          cost: it.cost,
          notes: `SOP ${id} adj`,
        }));

      if (mutations.length > 0) {
        try {
          await applyBatchStockMutations({
            mutations,
            type: "SOP",
            refType: "STOCK_OPNAME",
            refId: id,
            actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
            allowNegative: false,
          });
        } catch (err: any) {
          return errorResponse("Posting gagal: " + err.message, 400);
        }
      }

      const mask = "updateMask.fieldPaths=status&updateMask.fieldPaths=postedBy&updateMask.fieldPaths=postedAt";
      const res = await warungFsFetch(`${headUrl}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { status: { stringValue: "POSTED" }, postedBy: { stringValue: user.id }, postedAt: { timestampValue: new Date().toISOString() } } }),
      });
      if (!res.ok) return errorResponse("Gagal POST status (stock terlanjur diupdate).", 500);

      await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "POST_OPNAME", entity: "warung_stock_opnames", entityId: id, after: { mutations: mutations.length } });
      return okResponse({ opnameId: id, status: "POSTED", mutations: mutations.length }, `Opname diposting (${mutations.length} mutasi).`);
    }

    return errorResponse("action harus REVIEW atau POST.", 400);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { id } = await ctx.params;
  try {
    const base = warungDatastoreBase();
    const headUrl = `${base}/warung_stock_opnames/${encodeURIComponent(id)}`;
    const headRes = await warungFsFetch(headUrl);
    if (!headRes.ok) return notFoundResponse("Opname tidak ditemukan.");
    const hj: any = await headRes.json();
    if (hj.fields?.status?.stringValue !== "DRAFT") return errorResponse("Hanya DRAFT bisa dihapus.", 400);

    const itemsRes = await warungFsFetch(`${base}/warung_stock_opnames_items?pageSize=1000`);
    if (itemsRes.ok) {
      const ij: any = await itemsRes.json();
      const toDelete = (ij.documents || []).filter((d: any) => d.fields?.opnameId?.stringValue === id);
      for (const d of toDelete) {
        const itemId = d.name.split("/").pop();
        await warungFsFetch(`${base}/warung_stock_opnames_items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
      }
    }
    await warungFsFetch(headUrl, { method: "DELETE" });
    await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "DELETE_OPNAME", entity: "warung_stock_opnames", entityId: id });
    return okResponse({ opnameId: id }, "Opname dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}