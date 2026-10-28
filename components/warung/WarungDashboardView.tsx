"use client";

import React, { useEffect, useState } from "react";

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function WarungDashboardView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    try {
      const [bsRes, financeRes] = await Promise.all([
        fetch(`/api/warung/reports/balance-sheet?asOf=${encodeURIComponent(asOf)}`),
        fetch(`/api/warung/reports/finance`),
      ]);
      const bsJ = await bsRes.json();
      const finJ = await financeRes.json();
      setData({ bs: bsJ.success ? bsJ.data : null, finance: finJ.success ? finJ.data : null });
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex justify-between items-center flex-wrap gap-2">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Ringkasan Warung</span>
          <p className="text-[11px] text-slate-500">Kinerja keuangan ringkas</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Refresh</button>
        </div>
      </div>

      {loading && <div className="p-6 text-center text-xs text-slate-500">Memuat...</div>}

      {data?.bs && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-[11px] uppercase font-bold text-emerald-800">Total Aset</div>
            <div className="font-mono font-bold text-lg mt-1 text-emerald-700">{fmtRp(data.bs.totalAset)}</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
            <div className="text-[11px] uppercase font-bold text-rose-800">Kewajiban + Ekuitas</div>
            <div className="font-mono font-bold text-lg mt-1 text-rose-700">{fmtRp(data.bs.totalPasivaCheck)}</div>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
            <div className="text-[11px] uppercase font-bold text-sky-800">Laba Berjalan</div>
            <div className={`font-mono font-bold text-lg mt-1 ${data.bs.labaBerjalan >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmtRp(data.bs.labaBerjalan)}</div>
          </div>
        </div>
      )}

      {data?.finance && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-[11px] uppercase font-bold text-slate-700 mb-2">Kas (Total Semua)</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span>Masuk</span><span className="font-mono font-bold text-emerald-700">{fmtRp(data.finance.cash.cashIn)}</span></div>
              <div className="flex justify-between"><span>Keluar</span><span className="font-mono font-bold text-rose-700">{fmtRp(data.finance.cash.cashOut)}</span></div>
              <div className="flex justify-between border-t pt-1 mt-1"><span className="font-bold">Net</span><span className="font-mono font-bold">{fmtRp(data.finance.cash.net)}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-[11px] uppercase font-bold text-slate-700 mb-2">Piutang & Utang Sisa</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span>Piutang Sisa</span><span className="font-mono font-bold text-amber-700">{fmtRp(data.finance.receivables.remaining)}</span></div>
              <div className="flex justify-between"><span>Utang Sisa</span><span className="font-mono font-bold text-rose-700">{fmtRp(data.finance.payables.remaining)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}