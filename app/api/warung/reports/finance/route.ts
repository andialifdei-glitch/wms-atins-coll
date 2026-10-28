import { NextRequest } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, errorResponse, unauthorizedResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  try {
    const base = warungDatastoreBase();
    const [cfRes, arRes, apRes] = await Promise.all([
      warungFsFetch(`${base}/warung_cash_flows?pageSize=500`),
      warungFsFetch(`${base}/warung_receivables?pageSize=500`),
      warungFsFetch(`${base}/warung_payables?pageSize=500`),
    ]);

    function inRange(date: string): boolean {
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    }

    let cashIn = 0, cashOut = 0;
    if (cfRes.ok) {
      const j: any = await cfRes.json();
      (j.documents || []).forEach((d: any) => {
        if (d.fields?.status?.stringValue === "VOID") return;
        const date = d.fields?.flowDate?.stringValue || "";
        if (!inRange(date)) return;
        const amt = parseInt(d.fields?.amount?.integerValue || "0", 10);
        if (d.fields?.flowType?.stringValue === "IN") cashIn += amt;
        else if (d.fields?.flowType?.stringValue === "OUT") cashOut += amt;
      });
    }

    let arTotal = 0, arPaid = 0, arRemaining = 0;
    if (arRes.ok) {
      const j: any = await arRes.json();
      (j.documents || []).forEach((d: any) => {
        if (d.fields?.status?.stringValue === "CANCELLED") return;
        const date = d.fields?.arDate?.stringValue || "";
        if (!inRange(date)) return;
        const amt = parseInt(d.fields?.amount?.integerValue || "0", 10);
        const paid = parseInt(d.fields?.paidAmount?.integerValue || "0", 10);
        arTotal += amt;
        arPaid += paid;
        arRemaining += (amt - paid);
      });
    }

    let apTotal = 0, apPaid = 0, apRemaining = 0;
    if (apRes.ok) {
      const j: any = await apRes.json();
      (j.documents || []).forEach((d: any) => {
        if (d.fields?.status?.stringValue === "CANCELLED") return;
        const date = d.fields?.apDate?.stringValue || "";
        if (!inRange(date)) return;
        const amt = parseInt(d.fields?.amount?.integerValue || "0", 10);
        const paid = parseInt(d.fields?.paidAmount?.integerValue || "0", 10);
        apTotal += amt;
        apPaid += paid;
        apRemaining += (amt - paid);
      });
    }

    return okResponse({
      cash: { cashIn, cashOut, net: cashIn - cashOut },
      receivables: { total: arTotal, paid: arPaid, remaining: arRemaining },
      payables: { total: apTotal, paid: apPaid, remaining: apRemaining },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}