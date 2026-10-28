import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

async function appendLog(base: string, ccId: string, existing: any, newEntry: { action: string; amount?: number; notes?: string }, actorId: string) {
  const docUrl = `${base}/warung_cash_counts/${encodeURIComponent(ccId)}`;
  const res = await warungFsFetch(docUrl);
  if (!res.ok) throw new Error("read cash count gagal");
  const j: any = await res.json();
  const logsRaw = j.fields?.logs?.arrayValue?.values || [];
  const newLogs = [...logsRaw, {
    mapValue: {
      fields: {
        action: { stringValue: newEntry.action },
        at: { timestampValue: new Date().toISOString() },
        by: { stringValue: actorId },
        amount: { integerValue: String(newEntry.amount || 0) },
        notes: { stringValue: newEntry.notes || "" },
      },
    },
  }];
  const mask = "updateMask.fieldPaths=logs";
  return warungFsFetch(`${docUrl}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { logs: { arrayValue: { values: newLogs } } } }),
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ ccId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  const { ccId } = await ctx.params;
  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_cash_counts/${encodeURIComponent(ccId)}`);
    if (!res.ok) return notFoundResponse("Cash count tidak ditemukan.");
    const j: any = await res.json();
    const f = j.fields || {};
    const logsRaw = f.logs?.arrayValue?.values || [];
    const logs = logsRaw.map((v: any) => {
      const m = v.mapValue?.fields || {};
      return {
        action: m.action?.stringValue || "",
        at: m.at?.timestampValue || "",
        by: m.by?.stringValue || "",
        amount: parseInt(m.amount?.integerValue || "0", 10),
        notes: m.notes?.stringValue || "",
      };
    });
    return okResponse({
      ccId: f.ccId?.stringValue || ccId,
      countDate: f.countDate?.stringValue || "",
      label: f.label?.stringValue || "OPEN",
      openingAmount: parseInt(f.openingAmount?.integerValue || "0", 10),
      openingAt: f.openingAt?.timestampValue || "",
      openingBy: f.openingBy?.stringValue || "",
      closingAmount: parseInt(f.closingAmount?.integerValue || "0", 10),
      closingAt: f.closingAt?.timestampValue || "",
      closingBy: f.closingBy?.stringValue || "",
      expectedCash: parseInt(f.expectedCash?.integerValue || "0", 10),
      variance: parseInt(f.variance?.integerValue || "0", 10),
      varianceReason: f.varianceReason?.stringValue || "",
      notes: f.notes?.stringValue || "",
      logs,
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ ccId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const { ccId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_cash_counts/${encodeURIComponent(ccId)}`;
    const getRes = await warungFsFetch(docUrl);
    if (!getRes.ok) return notFoundResponse("Cash count tidak ditemukan.");
    const j: any = await getRes.json();
    const label = j.fields?.label?.stringValue || "OPEN";

    if (action === "UPDATE_OPENING") {
      if (label === "COMPLETED") return errorResponse("Sudah COMPLETED, tidak bisa ubah opening.", 400);
      const openingAmount = Math.max(0, Math.trunc(Number(body.openingAmount || 0)));
      const notes = String(body.notes || "").trim();
      const mask = "updateMask.fieldPaths=openingAmount&updateMask.fieldPaths=notes";
      const res = await warungFsFetch(`${docUrl}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: { openingAmount: { integerValue: String(openingAmount) }, notes: { stringValue: notes } } }),
      });
      if (!res.ok) return errorResponse("Gagal update opening.", 500);
      await appendLog(base, ccId, j, { action: "UPDATE_OPENING", amount: openingAmount, notes }, user.id);
      await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "UPDATE_CC_OPENING", entity: "warung_cash_counts", entityId: ccId });
      return okResponse({ ccId, openingAmount }, "Opening diperbarui.");
    }

    if (action === "CLOSE") {
      if (label === "COMPLETED") return errorResponse("Sudah COMPLETED.", 400);
      const closingAmount = Math.max(0, Math.trunc(Number(body.closingAmount || 0)));
      const expectedCash = Math.max(0, Math.trunc(Number(body.expectedCash || 0)));
      const variance = closingAmount - expectedCash;
      const varianceReason = String(body.varianceReason || "").trim();
      const notes = String(body.notes || "").trim();
      const nowIso = new Date().toISOString();
      const mask = "updateMask.fieldPaths=label&updateMask.fieldPaths=closingAmount&updateMask.fieldPaths=closingAt&updateMask.fieldPaths=closingBy&updateMask.fieldPaths=expectedCash&updateMask.fieldPaths=variance&updateMask.fieldPaths=varianceReason&updateMask.fieldPaths=notes";
      const res = await warungFsFetch(`${docUrl}?${mask}`, {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            label: { stringValue: "COMPLETED" },
            closingAmount: { integerValue: String(closingAmount) },
            closingAt: { timestampValue: nowIso },
            closingBy: { stringValue: user.id },
            expectedCash: { integerValue: String(expectedCash) },
            variance: { integerValue: String(variance) },
            varianceReason: { stringValue: varianceReason },
            notes: { stringValue: notes },
          },
        }),
      });
      if (!res.ok) return errorResponse("Gagal close.", 500);
      await appendLog(base, ccId, j, { action: "CLOSE", amount: closingAmount, notes: varianceReason }, user.id);
      await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "CLOSE_CASH_COUNT", entity: "warung_cash_counts", entityId: ccId, after: { closingAmount, expectedCash, variance } });
      return okResponse({ ccId, closingAmount, expectedCash, variance }, "Cash count ditutup.");
    }

    return errorResponse("action harus UPDATE_OPENING atau CLOSE.", 400);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ ccId: string }> }) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();
  const { ccId } = await ctx.params;
  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_cash_counts/${encodeURIComponent(ccId)}`;
    const res = await warungFsFetch(docUrl, { method: "DELETE" });
    if (!res.ok) return errorResponse("Gagal hapus.", 500);
    await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "DELETE_CASH_COUNT", entity: "warung_cash_counts", entityId: ccId });
    return okResponse({ ccId }, "Cash count dihapus.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}