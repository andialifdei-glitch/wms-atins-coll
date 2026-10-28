"use client";

import React, { useEffect, useState } from "react";

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function FinanceReportView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const res = await fetch("/api/warung/reports/finance?" + p.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setData(j.data);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Laporan Keuangan</span>
          <p className="text-[11px] text-slate-500">Kas, Piutang, Utang</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Tampilkan</button>
        </div>
      </div>

      {loading && <div className="p-6 text-center text-xs text-slate-500">Memuat...</div>}

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-[11px] uppercase font-bold text-emerald-800">Kas</div>
            <div className="text-sm mt-2 space-y-1">
              <div className="flex justify-between"><span>Masuk</span><b className="font-mono">{fmtRp(data.cash.cashIn)}</b></div>
              <div className="flex justify-between"><span>Keluar</span><b className="font-mono text-rose-700">{fmtRp(data.cash.cashOut)}</b></div>
              <div className="flex justify-between border-t border-emerald-300 pt-1 mt-1"><span className="font-bold">Net</span><b className="font-mono">{fmtRp(data.cash.net)}</b></div>
            </div>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
            <div className="text-[11px] uppercase font-bold text-sky-800">Piutang</div>
            <div className="text-sm mt-2 space-y-1">
              <div className="flex justify-between"><span>Total</span><b className="font-mono">{fmtRp(data.receivables.total)}</b></div>
              <div className="flex justify-between"><span>Dibayar</span><b className="font-mono text-emerald-700">{fmtRp(data.receivables.paid)}</b></div>
              <div className="flex justify-between border-t border-sky-300 pt-1 mt-1"><span className="font-bold">Sisa</span><b className="font-mono text-rose-700">{fmtRp(data.receivables.remaining)}</b></div>
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
            <div className="text-[11px] uppercase font-bold text-rose-800">Utang</div>
            <div className="text-sm mt-2 space-y-1">
              <div className="flex justify-between"><span>Total</span><b className="font-mono">{fmtRp(data.payables.total)}</b></div>
              <div className="flex justify-between"><span>Dibayar</span><b className="font-mono text-emerald-700">{fmtRp(data.payables.paid)}</b></div>
              <div className="flex justify-between border-t border-rose-300 pt-1 mt-1"><span className="font-bold">Sisa</span><b className="font-mono text-rose-700">{fmtRp(data.payables.remaining)}</b></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}