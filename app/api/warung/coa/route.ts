import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { logActivity } from "@/lib/warung/activityLog";
import { ensureSystemAccounts, type CoaType } from "@/lib/warung/coa";

export const dynamic = "force-dynamic";

const VALID_TYPES: CoaType[] = ["ASET", "KEWAJIBAN", "EKUITAS", "PENDAPATAN", "BEBAN"];

function docToCoa(d: any) {
  const f = d.fields || {};
  return {
    coaCode: f.coaCode?.stringValue || d.name.split("/").pop(),
    coaName: f.coaName?.stringValue || "",
    type: f.type?.stringValue || "ASET",
    normalBalance: f.normalBalance?.stringValue || "DEBIT",
    active: f.active?.booleanValue ?? true,
    isSystem: f.isSystem?.booleanValue ?? false,
    notes: f.notes?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "").trim();
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const activeOnly = searchParams.get("active") === "true";

  try {
    await ensureSystemAccounts({ uid: user.uid, id: user.id, name: user.name, role: user.role });
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_coa?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal baca COA.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToCoa);
    if (type) items = items.filter((x: any) => x.type === type);
    if (q) items = items.filter((x: any) => x.coaCode.toLowerCase().includes(q) || x.coaName.toLowerCase().includes(q));
    if (activeOnly) items = items.filter((x: any) => x.active);
    items.sort((a: any, b: any) => a.coaCode.localeCompare(b.coaCode));
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
  const coaCode = String(body.coaCode || "").trim();
  const coaName = String(body.coaName || "").trim();
  const type = String(body.type || "").toUpperCase() as CoaType;
  const normalBalance = String(body.normalBalance || "DEBIT").toUpperCase();
  const notes = String(body.notes || "").trim();

  if (!coaCode) return errorResponse("coaCode wajib.");
  if (!/^[0-9-]+$/.test(coaCode)) return errorResponse("coaCode hanya angka & tanda hubung (misal 1-2001).");
  if (!coaName) return errorResponse("coaName wajib.");
  if (!VALID_TYPES.includes(type)) return errorResponse("type tidak valid.");
  if (normalBalance !== "DEBIT" && normalBalance !== "KREDIT") return errorResponse("normalBalance harus DEBIT atau KREDIT.");

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_coa/${encodeURIComponent(coaCode)}`;
    const checkRes = await warungFsFetch(docUrl);
    if (checkRes.ok) return errorResponse(`Akun ${coaCode} sudah ada.`, 409);

    const payload = {
      fields: {
        coaCode: { stringValue: coaCode },
        coaName: { stringValue: coaName },
        type: { stringValue: type },
        normalBalance: { stringValue: normalBalance },
        active: { booleanValue: true },
        isSystem: { booleanValue: false },
        notes: { stringValue: notes },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(docUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Gagal simpan COA.", 500);

    const actor = { uid: user.uid, id: user.id, name: user.name, role: user.role };
    await writeAuditLog({ actor, action: "CREATE_COA", entity: "warung_coa", entityId: coaCode, after: { coaCode, coaName, type } });
    await logActivity({ category: "COA", action: "CREATE", entityId: coaCode, entityLabel: `COA ${coaCode} ${coaName}`, actor, notes });

    return okResponse({ coaCode, coaName, type }, `COA ${coaCode} dibuat.`);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}