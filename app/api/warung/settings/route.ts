import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";

export const dynamic = "force-dynamic";

const DOC_ID = "store_info";

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_settings/${DOC_ID}`);
    if (!res.ok) {
      // Default kosong
      return okResponse({
        storeName: "",
        storeAddress: "",
        storePhone: "",
        storeEmail: "",
        storeNpwp: "",
        storeNotes: "",
        receiptFooter: "",
      });
    }
    const j: any = await res.json();
    const f = j.fields || {};
    return okResponse({
      storeName: f.storeName?.stringValue || "",
      storeAddress: f.storeAddress?.stringValue || "",
      storePhone: f.storePhone?.stringValue || "",
      storeEmail: f.storeEmail?.stringValue || "",
      storeNpwp: f.storeNpwp?.stringValue || "",
      storeNotes: f.storeNotes?.stringValue || "",
      receiptFooter: f.receiptFooter?.stringValue || "",
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();
  if (!requireRole(user, ["ROOT_ADMIN", "ADMIN_WARUNG"])) return forbiddenResponse();

  const body = await request.json().catch(() => ({}));
  try {
    const fields: any = { updatedAt: { timestampValue: new Date().toISOString() }, updatedBy: { stringValue: user.id } };
    const mask: string[] = ["updatedAt", "updatedBy"];
    const strFields = ["storeName", "storeAddress", "storePhone", "storeEmail", "storeNpwp", "storeNotes", "receiptFooter"];
    for (const k of strFields) {
      if (body[k] !== undefined) {
        fields[k] = { stringValue: String(body[k]).trim() };
        mask.push(k);
      }
    }

    const maskQuery = mask.map((f) => `updateMask.fieldPaths=${f}`).join("&");
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_settings/${DOC_ID}?${maskQuery}`, {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) return errorResponse("Gagal simpan pengaturan.", 500);

    await writeAuditLog({ actor: { uid: user.uid, id: user.id, name: user.name, role: user.role }, action: "UPDATE_SETTINGS", entity: "warung_settings", entityId: DOC_ID });
    return okResponse({}, "Pengaturan disimpan.");
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}