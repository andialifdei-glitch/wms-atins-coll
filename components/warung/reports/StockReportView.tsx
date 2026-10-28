"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Row { productCode: string; productName: string; unit: string; qty: number; minStock: number; capitalPrice: number; value: number; low: boolean; }

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function StockReportView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (lowOnly) params.set("lowOnly", "true");
      const res = await fetch("/api/warung/reports/stock?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) { setRows(j.data.rows); setTotalQty(j.data.totalQty); setTotalValue(j.data.totalValue); }
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const columns: Column<Row>[] = [
    { key: "productCode", label: "Kode", render: (r) => <span className="font-mono font-bold">{r.productCode}</span> },
    { key: "productName", label: "Nama" },
    { key: "qty", label: "Stok", render: (r) => <span className={`font-mono font-bold ${r.qty < 0 ? "text-rose-700" : r.low ? "text-amber-700" : ""}`}>{r.qty} {r.unit}</span> },
    { key: "minStock", label: "Min", render: (r) => <span className="font-mono">{r.minStock}</span> },
    { key: "capitalPrice", label: "HPP", render: (r) => <span className="font-mono text-[11px]">{fmtRp(r.capitalPrice)}</span> },
    { key: "value", label: "Nilai", render: (r) => <span className="font-mono text-[11px] font-bold">{fmtRp(r.value)}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Laporan Stok</span>
          <p className="text-[11px] text-slate-500">Saldo stok & nilai persediaan</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari kode/nama..." />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="w-4 h-4" /> Low only</label>
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Tampilkan</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-50 rounded p-2 border"><div className="text-slate-500">Total Item</div><div className="font-bold text-sm">{rows.length}</div></div>
        <div className="bg-slate-50 rounded p-2 border"><div className="text-slate-500">Total Qty</div><div className="font-bold text-sm font-mono">{totalQty}</div></div>
        <div className="bg-slate-50 rounded p-2 border"><div className="text-slate-500">Nilai Persediaan</div><div className="font-bold text-sm font-mono text-emerald-700">{fmtRp(totalValue)}</div></div>
      </div>

      <WarungDataTable columns={columns} data={rows} loading={loading} rowKey={(r) => r.productCode} emptyMessage="Belum ada produk." />
    </div>
  );
}