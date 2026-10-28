"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";

interface SaldoRow { coaCode: string; coaName: string; type: string; normalBalance: string; debit: number; credit: number; saldo: number; }

interface Statement {
  periodStart: string;
  periodEnd: string;
  pendapatan: SaldoRow[];
  totalPendapatan: number;
  beban: SaldoRow[];
  totalBeban: number;
  labaBersih: number;
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function IncomeStatementView() {
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch("/api/warung/reports/income-statement?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setData(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const columns: Column<SaldoRow>[] = [
    { key: "coaCode", label: "Kode", render: (r) => <span className="font-mono font-bold">{r.coaCode}</span> },
    { key: "coaName", label: "Akun" },
    { key: "saldo", label: "Saldo", render: (r) => <span className="font-mono font-bold text-right block">{fmtRp(r.saldo)}</span>, className: "text-right" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Laporan Laba Rugi</span>
          <p className="text-[11px] text-slate-500">Pendapatan − Beban untuk periode tertentu</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" title="Dari" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" title="Sampai" />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Tampilkan</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      {loading && <div className="p-6 text-center text-slate-500 text-xs">Memuat...</div>}

      {data && !loading && (
        <div className="space-y-4">
          <div className="text-xs text-slate-600">
            Periode: <b className="font-mono">{data.periodStart}</b> s/d <b className="font-mono">{data.periodEnd}</b>
          </div>

          <div>
            <div className="text-[11px] uppercase font-bold text-emerald-700 mb-1">Pendapatan</div>
            <WarungDataTable columns={columns} data={data.pendapatan} rowKey={(r) => r.coaCode} emptyMessage="Tidak ada pendapatan." />
            <div className="text-right text-xs font-bold text-emerald-700 pt-1">Total Pendapatan: {fmtRp(data.totalPendapatan)}</div>
          </div>

          <div>
            <div className="text-[11px] uppercase font-bold text-rose-700 mb-1">Beban</div>
            <WarungDataTable columns={columns} data={data.beban} rowKey={(r) => r.coaCode} emptyMessage="Tidak ada beban." />
            <div className="text-right text-xs font-bold text-rose-700 pt-1">Total Beban: {fmtRp(data.totalBeban)}</div>
          </div>

          <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center">
            <span className="text-xs font-bold uppercase">{data.labaBersih >= 0 ? "Laba Bersih" : "Rugi Bersih"}</span>
            <span className={`text-lg font-bold font-mono ${data.labaBersih >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmtRp(data.labaBersih)}</span>
          </div>
        </div>
      )}
    </div>
  );
}