import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

function docToJournal(d: any) {
  const f = d.fields || {};
  const entriesRaw = f.entries?.arrayValue?.values || [];
  const entries = entriesRaw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      coaCode: m.coaCode?.stringValue || "",
      coaName: m.coaName?.stringValue || "",
      debit: parseInt(m.debit?.integerValue || "0", 10),
      credit: parseInt(m.credit?.integerValue || "0", 10),
    };
  });
  return {
    journalId: f.journalId?.stringValue || d.name.split("/").pop(),
    journalDate: f.journalDate?.stringValue || "",
    description: f.description?.stringValue || "",
    refType: f.refType?.stringValue || "",
    refId: f.refId?.stringValue || "",
    entries,
    totalDebit: parseInt(f.totalDebit?.integerValue || "0", 10),
    totalCredit: parseInt(f.totalCredit?.integerValue || "0", 10),
    status: f.status?.stringValue || "POSTED",
    voidOfJournalId: f.voidOfJournalId?.stringValue || "",
    createdAt: f.createdAt?.timestampValue || "",
    createdBy: f.createdBy?.stringValue || "",
  };
}

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const refType = (searchParams.get("refType") || "").trim();
  const status = (searchParams.get("status") || "").trim();

  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_journals?pageSize=500`);
    if (!res.ok) return errorResponse("Gagal baca jurnal.", 500);
    const j: any = await res.json();
    let items = (j.documents || []).map(docToJournal);
    if (q) items = items.filter((x: any) => x.journalId.toLowerCase().includes(q) || x.description.toLowerCase().includes(q) || x.refId.toLowerCase().includes(q));
    if (from) items = items.filter((x: any) => x.journalDate >= from);
    if (to) items = items.filter((x: any) => x.journalDate <= to);
    if (refType) items = items.filter((x: any) => x.refType === refType);
    if (status) items = items.filter((x: any) => x.status === status);
    items.sort((a: any, b: any) => {
      const cmp = String(b.journalDate).localeCompare(String(a.journalDate));
      if (cmp !== 0) return cmp;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    return okResponse(items);
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}