"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function PurchaseReportView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (q) p.set("q", q);
      const res = await fetch("/api/warung/reports/purchases?" + p.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setData(j.data);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const poColumns: Column<any>[] = [
    { key: "poId", label: "PO", render: (r) => <span className="font-mono font-bold">{r.poId}</span> },
    { key: "supplierName", label: "Supplier" },
    { key: "orderDate", label: "Tgl", render: (r) => <span className="font-mono text-[10px]">{r.orderDate}</span> },
    { key: "status", label: "Status" },
    { key: "totalAmount", label: "Total", render: (r) => <span className="font-mono text-[11px]">{fmtRp(r.totalAmount)}</span> },
  ];
  const rcvColumns: Column<any>[] = [
    { key: "rcvId", label: "RCV", render: (r) => <span className="font-mono font-bold">{r.rcvId}</span> },
    { key: "poId", label: "PO", render: (r) => <span className="font-mono text-[10px]">{r.poId}</span> },
    { key: "supplierName", label: "Supplier" },
    { key: "receiveDate", label: "Tgl", render: (r) => <span className="font-mono text-[10px]">{r.receiveDate}</span> },
    { key: "totalAmount", label: "Total", render: (r) => <span className="font-mono text-[11px]">{fmtRp(r.totalAmount)}</span> },
  ];
  const rtrColumns: Column<any>[] = [
    { key: "rtrId", label: "RTR", render: (r) => <span className="font-mono font-bold">{r.rtrId}</span> },
    { key: "rcvId", label: "RCV", render: (r) => <span className="font-mono text-[10px]">{r.rcvId}</span> },
    { key: "supplierName", label: "Supplier" },
    { key: "returnDate", label: "Tgl", render: (r) => <span className="font-mono text-[10px]">{r.returnDate}</span> },
    { key: "totalAmount", label: "Total", render: (r) => <span className="font-mono text-[11px] text-rose-700">{fmtRp(r.totalAmount)}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Laporan Pembelian</span>
          <p className="text-[11px] text-slate-500">PO, Receiving, Retur</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Tampilkan</button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 rounded p-2 border"><div className="text-slate-500">Total PO</div><div className="font-bold font-mono text-sm">{fmtRp(data.summary.totalPo)}</div></div>
          <div className="bg-slate-50 rounded p-2 border"><div className="text-slate-500">Total Receiving</div><div className="font-bold font-mono text-sm">{fmtRp(data.summary.totalRcv)}</div></div>
          <div className="bg-slate-50 rounded p-2 border"><div className="text-slate-500">Net Pembelian</div><div className="font-bold font-mono text-sm text-emerald-700">{fmtRp(data.summary.netPurchase)}</div></div>
        </div>
      )}

      {data && (
        <>
          <div>
            <div className="text-[11px] uppercase font-bold text-amber-700 mb-1">PO ({data.pos.length})</div>
            <WarungDataTable columns={poColumns} data={data.pos} loading={loading} rowKey={(r) => r.poId} emptyMessage="-" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-emerald-700 mb-1">Receiving ({data.receivings.length})</div>
            <WarungDataTable columns={rcvColumns} data={data.receivings} loading={loading} rowKey={(r) => r.rcvId} emptyMessage="-" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-rose-700 mb-1">Retur ({data.returns.length})</div>
            <WarungDataTable columns={rtrColumns} data={data.returns} loading={loading} rowKey={(r) => r.rtrId} emptyMessage="-" />
          </div>
        </>
      )}
    </div>
  );
}