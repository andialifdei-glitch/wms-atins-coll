"use client";

import React, { useEffect, useMemo, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Sale {
  saleId: string;
  saleDate: string;
  customerName: string;
  paymentMethod: string;
  totalAmount: number;
  remainingAmount: number;
  status: string;
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function SalesReportView() {
  const [items, setItems] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const res = await fetch("/api/warung/sales?" + p.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const stats = useMemo(() => {
    const valid = items.filter((x) => x.status === "POSTED");
    const cash = valid.filter((x) => x.paymentMethod === "CASH").reduce((s, x) => s + x.totalAmount, 0);
    const credit = valid.filter((x) => x.paymentMethod === "CREDIT").reduce((s, x) => s + x.totalAmount, 0);
    return { count: valid.length, cash, credit, total: cash + credit };
  }, [items]);

  const columns: Column<Sale>[] = [
    { key: "saleId", label: "ID", render: (r) => <span className="font-mono font-bold">{r.saleId}</span> },
    { key: "saleDate", label: "Tanggal", render: (r) => <span className="font-mono text-[11px]">{r.saleDate}</span> },
    { key: "customerName", label: "Customer" },
    { key: "paymentMethod", label: "Bayar", render: (r) => <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.paymentMethod === "CASH" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.paymentMethod}</span> },
    { key: "totalAmount", label: "Total", render: (r) => <span className="font-mono text-[11px] font-bold">{fmtRp(r.totalAmount)}</span> },
    { key: "status", label: "Status", render: (r) => <span className={r.status === "VOID" ? "text-rose-700 text-[10px] font-bold" : "text-[10px] text-emerald-700"}>{r.status}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Laporan Penjualan</span>
          <p className="text-[11px] text-slate-500">Riwayat transaksi POS</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari id/customer..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Tampilkan</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 rounded p-2 border"><div className="text-slate-500">Transaksi</div><div className="font-bold text-sm">{stats.count}</div></div>
        <div className="bg-emerald-50 rounded p-2 border border-emerald-200"><div className="text-emerald-700">Tunai</div><div className="font-bold text-sm font-mono">{fmtRp(stats.cash)}</div></div>
        <div className="bg-amber-50 rounded p-2 border border-amber-200"><div className="text-amber-700">Kredit</div><div className="font-bold text-sm font-mono">{fmtRp(stats.credit)}</div></div>
        <div className="bg-sky-50 rounded p-2 border border-sky-200"><div className="text-sky-700">Total</div><div className="font-bold text-sm font-mono">{fmtRp(stats.total)}</div></div>
      </div>

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.saleId} emptyMessage="Belum ada penjualan." />
    </div>
  );
}