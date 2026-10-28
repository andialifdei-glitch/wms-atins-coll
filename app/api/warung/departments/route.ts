import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

function docToDept(d: any) {
  const f = d.fields || {};
  return {
    deptId: f.deptId?.stringValue || "",
    divCode: f.divCode?.stringValue || "",
    deptCode: f.deptCode?.stringValue || "",
    deptName: f.deptName?.stringValue || "",
    active: f.active?.booleanValue ?? true,
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const divCode = (searchParams.get("divCode") || "").trim();
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const activeOnly = searchParams.get("active") === "true";

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_departments?pageSize=300`);
    if (!res.ok) return errorResponse("Gagal membaca departemen.", 500);
    const data: any = await res.json();
    let items: Array<{ deptId: string; divCode: string; deptCode: string; deptName: string; active: boolean }> = (data.documents || []).map(docToDept);
    if (divCode) items = items.filter((d) => d.divCode === divCode);
    if (q) items = items.filter((d) => d.deptId.toLowerCase().includes(q) || d.deptName.toLowerCase().includes(q));
    if (activeOnly) items = items.filter((d) => d.active);
    items.sort((a, b) => a.deptId.localeCompare(b.deptId));
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
  const deptName = String(body.deptName || "").trim();

  if (!/^[0-9]{1}$/.test(divCode)) return errorResponse("divCode harus 1 digit.");
  if (!/^[0-9]{1}$/.test(deptCode)) return errorResponse("deptCode harus 1 digit (0-9).");
  if (!deptName) return errorResponse("deptName wajib diisi.");

  const deptId = `${divCode}-${deptCode}`;

  try {
    const base = warungDatastoreBase();
    // Verifikasi divisi ada
    const divRes = await warungFsFetch(`${base}/warung_divisions/${encodeURIComponent(divCode)}`);
    if (!divRes.ok) return errorResponse("Divisi tidak ditemukan.", 400);

    const docUrl = `${base}/warung_departments/${encodeURIComponent(deptId)}`;
    const checkRes = await warungFsFetch(docUrl);
    if (checkRes.ok) return errorResponse(`Departemen ${deptId} sudah ada.`, 409);

    const payload = {
      fields: {
        deptId: { stringValue: deptId },
        divCode: { stringValue: divCode },
        deptCode: { stringValue: deptCode },
        deptName: { stringValue: deptName },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(docUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) return errorResponse("Gagal menyimpan departemen.", 500);

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_DEPARTMENT",
      entity: "warung_departments",
      entityId: deptId,
      after: { deptId, divCode, deptCode, deptName },
    });

    return okResponse({ deptId, divCode, deptCode, deptName }, "Departemen berhasil dibuat.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}