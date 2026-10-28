import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

function docToFamily(d: any) {
  const f = d.fields || {};
  return {
    famCode: f.famCode?.stringValue || "",
    divCode: f.divCode?.stringValue || "",
    deptCode: f.deptCode?.stringValue || "",
    familyCodeLocal: f.familyCodeLocal?.stringValue || "",
    familyName: f.familyName?.stringValue || "",
    active: f.active?.booleanValue ?? true,
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const divCode = (searchParams.get("divCode") || "").trim();
  const deptCode = (searchParams.get("deptCode") || "").trim();
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const activeOnly = searchParams.get("active") === "true";

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_families?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal membaca family.", 500);
    const data: any = await res.json();
    let items: Array<{ famCode: string; divCode: string; deptCode: string; familyCodeLocal: string; familyName: string; active: boolean }> = (data.documents || []).map(docToFamily);
    if (divCode) items = items.filter((d) => d.divCode === divCode);
    if (deptCode) items = items.filter((d) => d.deptCode === deptCode);
    if (q) items = items.filter((d) => d.famCode.includes(q) || d.familyName.toLowerCase().includes(q));
    if (activeOnly) items = items.filter((d) => d.active);
    items.sort((a, b) => a.famCode.localeCompare(b.famCode));
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
  const divCode = String(body.divCode || "").trim();
  const deptCode = String(body.deptCode || "").trim();
  const familyCodeLocal = String(body.familyCodeLocal || "").trim();
  const familyName = String(body.familyName || "").trim();

  if (!/^[0-9]{1}$/.test(divCode)) return errorResponse("divCode harus 1 digit.");
  if (!/^[0-9]{1}$/.test(deptCode)) return errorResponse("deptCode harus 1 digit (0-9).");
  if (!/^[0-9]{1}$/.test(familyCodeLocal)) return errorResponse("familyCodeLocal harus 1 digit (0-9).");
  if (!familyName) return errorResponse("familyName wajib diisi.");

  const famCode = `${divCode}${deptCode}${familyCodeLocal}`;

  try {
    const base = warungDatastoreBase();
    // Verifikasi dept ada
    const deptRes = await warungFsFetch(`${base}/warung_departments/${encodeURIComponent(`${divCode}-${deptCode}`)}`);
    if (!deptRes.ok) return errorResponse("Departemen tidak ditemukan.", 400);

    const docUrl = `${base}/warung_families/${encodeURIComponent(famCode)}`;
    const checkRes = await warungFsFetch(docUrl);
    if (checkRes.ok) return errorResponse(`Family ${famCode} sudah ada.`, 409);

    const payload = {
      fields: {
        famCode: { stringValue: famCode },
        divCode: { stringValue: divCode },
        deptCode: { stringValue: deptCode },
        familyCodeLocal: { stringValue: familyCodeLocal },
        familyName: { stringValue: familyName },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(docUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Gagal menyimpan family.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_FAMILY",
      entity: "warung_families",
      entityId: famCode,
      after: { famCode, divCode, deptCode, familyCodeLocal, familyName },
    });

    return okResponse({ famCode, divCode, deptCode, familyCodeLocal, familyName }, "Family berhasil dibuat.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}