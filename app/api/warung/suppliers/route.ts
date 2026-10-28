import { NextRequest } from "next/server";
import { getWarungSessionUser, requireRole } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/warung/response";
import { writeAuditLog } from "@/lib/warung/audit";
import { nextSequence, padSequence } from "@/lib/warung/counters";

export const dynamic = "force-dynamic";

interface SupplierDTO {
  supplierCode: string;
  supplierName: string;
  phone: string;
  address: string;
  contactPerson: string;
  email: string;
  notes: string;
  active: boolean;
}

function docToSupplier(d: any): SupplierDTO {
  const f = d.fields || {};
  return {
    supplierCode: f.supplierCode?.stringValue || "",
    supplierName: f.supplierName?.stringValue || "",
    phone: f.phone?.stringValue || "",
    address: f.address?.stringValue || "",
    contactPerson: f.contactPerson?.stringValue || "",
    email: f.email?.stringValue || "",
    notes: f.notes?.stringValue || "",
    active: f.active?.booleanValue ?? true,
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const activeOnly = searchParams.get("active") === "true";

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_suppliers?pageSize=300`);
    if (!res.ok) return errorResponse("Gagal membaca supplier.", 500);
    const data: any = await res.json();
    let items: SupplierDTO[] = (data.documents || []).map(docToSupplier);
    if (q) items = items.filter((d) => d.supplierCode.toLowerCase().includes(q) || d.supplierName.toLowerCase().includes(q) || d.phone.toLowerCase().includes(q));
    if (activeOnly) items = items.filter((d) => d.active);
    items.sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));
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
  const supplierName = String(body.supplierName || "").trim();
  if (!supplierName) return errorResponse("Nama supplier wajib diisi.");

  try {
    const seq = await nextSequence("supplier", 1);
    const supplierCode = `SUPP-${padSequence(seq, 3)}`;
    const base = warungDatastoreBase();
    const docUrl = `${base}/warung_suppliers/${encodeURIComponent(supplierCode)}`;

    const payload = {
      fields: {
        supplierCode: { stringValue: supplierCode },
        supplierName: { stringValue: supplierName },
        phone: { stringValue: String(body.phone || "").trim() },
        address: { stringValue: String(body.address || "").trim() },
        contactPerson: { stringValue: String(body.contactPerson || "").trim() },
        email: { stringValue: String(body.email || "").trim() },
        notes: { stringValue: String(body.notes || "").trim() },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: user.id },
      },
    };
    const res = await warungFsFetch(docUrl, { method: "PATCH", body: JSON.stringify(payload) });
    if (!res.ok) {
      const txt = await res.text();
      return errorResponse("Gagal menyimpan supplier.", 500, { detail: txt.slice(0, 300) });
    }

    await writeAuditLog({
      actor: { uid: user.uid, id: user.id, name: user.name, role: user.role },
      action: "CREATE_SUPPLIER",
      entity: "warung_suppliers",
      entityId: supplierCode,
      after: { supplierCode, supplierName },
    });

    return okResponse({ supplierCode, supplierName }, `Supplier ${supplierCode} berhasil dibuat.`);
  } catch (e: any) {
    console.error("[suppliers POST]", e.message);
    return errorResponse(e.message, 500);
  }
}