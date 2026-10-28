"use client";

import React, { useEffect, useState } from "react";

interface SaldoRow { coaCode: string; coaName: string; type: string; normalBalance: string; debit: number; credit: number; saldo: number; }

interface BS {
  asOfDate: string;
  aset: SaldoRow[];
  totalAset: number;
  kewajiban: SaldoRow[];
  totalKewajiban: number;
  ekuitas: SaldoRow[];
  totalEkuitas: number;
  labaBerjalan: number;
  totalAsetCheck: number;
  totalPasivaCheck: number;
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

function Section({ title, rows, total, color }: { title: string; rows: SaldoRow[]; total: number; color: string }) {
  return (
    <div>
      <div className={`text-[11px] uppercase font-bold mb-1 ${color}`}>{title}</div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.coaCode} className="border-b border-slate-100">
              <td className="p-1 font-mono font-bold w-24">{r.coaCode}</td>
              <td className="p-1">{r.coaName}</td>
              <td className="p-1 font-mono text-right">{fmtRp(r.saldo)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="p-2 text-center text-slate-400 text-[10px]">Tidak ada saldo</td></tr>}
        </tbody>
      </table>
      <div className={`text-right text-xs font-bold pt-1 ${color}`}>Total: {fmtRp(total)}</div>
    </div>
  );
}

export default function BalanceSheetView() {
  const [data, setData] = useState<BS | null>(null);
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/warung/reports/balance-sheet?asOf=${encodeURIComponent(asOf)}`, { cache: "no-store" });
      const j = await res.json();
      if (j.success) setData(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const balanced = data ? Math.abs(data.totalAsetCheck - data.totalPasivaCheck) < 0.01 : false;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Neraca</span>
          <p className="text-[11px] text-slate-500">Aset = Kewajiban + Ekuitas</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" title="Per tanggal" />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Tampilkan</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      {loading && <div className="p-6 text-center text-slate-500 text-xs">Memuat...</div>}

      {data && !loading && (
        <div className="space-y-4">
          <div className="text-xs text-slate-600">Per tanggal: <b className="font-mono">{data.asOfDate}</b></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Section title="Aset" rows={data.aset} total={data.totalAset} color="text-emerald-700" />
            </div>
            <div className="space-y-3">
              <Section title="Kewajiban" rows={data.kewajiban} total={data.totalKewajiban} color="text-rose-700" />
              <Section title="Ekuitas" rows={data.ekuitas} total={data.totalEkuitas} color="text-sky-700" />
              <div className="text-xs">
                <div className="flex justify-between border-b border-slate-100 p-1">
                  <span className="italic">Laba Berjalan (belum ditutup)</span>
                  <span className="font-mono font-bold">{fmtRp(data.labaBerjalan)}</span>
                </div>
                <div className="flex justify-between p-1 font-bold text-slate-900">
                  <span>Total Kewajiban + Ekuitas</span>
                  <span className="font-mono">{fmtRp(data.totalPasivaCheck)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`text-center text-xs font-bold p-2 rounded border ${balanced ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
            {balanced ? "✓ Neraca Balance (Aset = Kewajiban + Ekuitas)" : `✗ TIDAK BALANCE — Aset: ${fmtRp(data.totalAsetCheck)} vs Pasiva: ${fmtRp(data.totalPasivaCheck)}`}
          </div>
        </div>
      )}
    </div>
  );
}