import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

function docToDivision(d: any) {
  const f = d.fields || {};
  return {
    divCode: f.divCode?.stringValue || "",
    divName: f.divName?.stringValue || "",
    active: f.active?.booleanValue ?? true,
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const activeOnly = searchParams.get("active") === "true";

  try {
    const url = `${warungDatastoreBase()}/warung_divisions?pageSize=300`;
    const res = await warungFsFetch(url);
    if (!res.ok) {
      const txt = await res.text();
      return errorResponse("Gagal membaca divisi.", 500, { detail: txt.slice(0, 300) });
    }
    const data: any = await res.json();
    const docs = data.documents || [];
    let items: Array<{ divCode: string; divName: string; active: boolean; createdAt: string; createdBy: string }> = docs.map(docToDivision);
    if (q) items = items.filter((d) => d.divCode.toLowerCase().includes(q) || d.divName.toLowerCase().includes(q));
    if (activeOnly) items = items.filter((d) => d.active);
    items.sort((a, b) => a.divCode.localeCompare(b.divCode));
    return okResponse(items);
  } catch (e: any) {
    console.error("[divisions GET]", e.message);
    return errorResponse(e.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse("Hanya Admin Warung.");

  const body = await request.json().catch(() => ({}));
  const divCode = String(body.divCode || "").trim();
  const divName = String(body.divName || "").trim();

  if (!divCode || !/^[0-9]{1}$/.test(divCode)) return errorResponse("divCode harus 1 digit angka (0-9).");
  if (!divName) return errorResponse("divName wajib diisi.");

  try {
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_divisions/${encodeURIComponent(divCode)}`;
    const checkRes = await warungFsFetch(docUrl);
    if (checkRes.ok) return errorResponse(`Divisi dengan kode ${divCode} sudah ada.`, 409);

    const payload = {
      fields: {
        divCode: { stringValue: divCode },
        divName: { stringValue: divName },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(docUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) {
      const txt = await res.text();
      return errorResponse("Gagal menyimpan divisi.", 500, { detail: txt.slice(0, 300) });
    }

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_DIVISION",
      entity: "warung_divisions",
      entityId: divCode,
      after: { divCode, divName },
    });

    return okResponse({ divCode, divName }, "Divisi berhasil dibuat.");
  } catch (e: any) {
    console.error("[divisions POST]", e.message);
    return errorResponse(e.message, 500);
  }
}