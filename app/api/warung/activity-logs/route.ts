import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const category = (searchParams.get("category") || "").trim();
  const action = (searchParams.get("action") || "").trim();
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_activity_logs?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal baca log.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map((d: any) => {
      const f = d.fields || {};
      return {
        logId: f.logId?.stringValue || d.name.split("/").pop(),
        category: f.category?.stringValue || "",
        action: f.action?.stringValue || "",
        entityId: f.entityId?.stringValue || "",
        entityLabel: f.entityLabel?.stringValue || "",
        amount: parseInt(f.amount?.integerValue || "0", 10),
        journalId: f.journalId?.stringValue || "",
        actorName: f.actorName?.stringValue || "",
        actorId: f.actorId?.stringValue || "",
        notes: f.notes?.stringValue || "",
        createdAt: f.createdAt?.timestampValue || "",
      };
    });
    if (category) items = items.filter((x: any) => x.category === category);
    if (action) items = items.filter((x: any) => x.action === action);
    if (q) items = items.filter((x: any) => x.entityId.toLowerCase().includes(q) || x.entityLabel.toLowerCase().includes(q) || x.actorName.toLowerCase().includes(q));
    if (from) items = items.filter((x: any) => x.createdAt.slice(0, 10) >= from);
    if (to) items = items.filter((x: any) => x.createdAt.slice(0, 10) <= to);
    items.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return okResponse(items);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}