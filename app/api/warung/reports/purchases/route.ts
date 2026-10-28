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
  const q = (searchParams.get("q") || "").toLowerCase().trim();

  try {
    const base = warungDatastoreBase();
    const [poRes, rcvRes, rtrRes] = await Promise.all([
      warungFsFetch(`${base}/warung_po?pageSize=500`),
      warungFsFetch(`${base}/warung_receivings?pageSize=500`),
      warungFsFetch(`${base}/warung_purchase_returns?pageSize=500`),
    ]);

    function inRange(date: string): boolean {
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    }

    let pos: any[] = [];
    if (poRes.ok) {
      const j: any = await poRes.json();
      pos = (j.documents || []).map((d: any) => ({
        poId: d.fields?.poId?.stringValue || "",
        supplierName: d.fields?.supplierName?.stringValue || "",
        orderDate: d.fields?.orderDate?.stringValue || "",
        status: d.fields?.status?.stringValue || "",
        totalAmount: parseInt(d.fields?.totalAmount?.integerValue || "0", 10),
      })).filter((x: any) => inRange(x.orderDate));
    }
    let receivings: any[] = [];
    if (rcvRes.ok) {
      const j: any = await rcvRes.json();
      receivings = (j.documents || []).map((d: any) => ({
        rcvId: d.fields?.rcvId?.stringValue || "",
        poId: d.fields?.poId?.stringValue || "",
        supplierName: d.fields?.supplierName?.stringValue || "",
        receiveDate: d.fields?.receiveDate?.stringValue || "",
        totalAmount: parseInt(d.fields?.totalAmount?.integerValue || "0", 10),
      })).filter((x: any) => inRange(x.receiveDate));
    }
    let returns: any[] = [];
    if (rtrRes.ok) {
      const j: any = await rtrRes.json();
      returns = (j.documents || []).map((d: any) => ({
        rtrId: d.fields?.rtrId?.stringValue || "",
        rcvId: d.fields?.rcvId?.stringValue || "",
        supplierName: d.fields?.supplierName?.stringValue || "",
        returnDate: d.fields?.returnDate?.stringValue || "",
        totalAmount: parseInt(d.fields?.totalAmount?.integerValue || "0", 10),
        reason: d.fields?.reason?.stringValue || "",
      })).filter((x: any) => inRange(x.returnDate));
    }

    if (q) {
      const lq = q.toLowerCase();
      pos = pos.filter((x: any) => x.poId.toLowerCase().includes(lq) || x.supplierName.toLowerCase().includes(lq));
      receivings = receivings.filter((x: any) => x.rcvId.toLowerCase().includes(lq) || x.poId.toLowerCase().includes(lq) || x.supplierName.toLowerCase().includes(lq));
      returns = returns.filter((x: any) => x.rtrId.toLowerCase().includes(lq) || x.supplierName.toLowerCase().includes(lq));
    }

    const totalPo = pos.reduce((s: number, x: any) => s + x.totalAmount, 0);
    const totalRcv = receivings.reduce((s: number, x: any) => s + x.totalAmount, 0);
    const totalRtr = returns.reduce((s: number, x: any) => s + x.totalAmount, 0);

    return okResponse({
      pos,
      receivings,
      returns,
      summary: { totalPo, totalRcv, totalRtr, netPurchase: totalRcv - totalRtr },
    });
  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}