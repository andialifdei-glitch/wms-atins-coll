"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";

interface Period {
  periodId: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: string;
  closedBy: string;
  netIncome: number;
  closingJournalId: string;
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function FiscalPeriodsView() {
  const [items, setItems] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [periodId, setPeriodId] = useState(new Date().toISOString().slice(0, 7));
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/warung/fiscal-periods", { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Tutup periode ${periodId}? Jurnal penutup akan diposting dan periode tidak bisa dibuka kembali.`)) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/fiscal-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setModalOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  const columns: Column<Period>[] = [
    { key: "periodId", label: "Periode", render: (r) => <span className="font-mono font-bold text-slate-900">{r.periodId}</span> },
    { key: "range", label: "Rentang", render: (r) => <span className="text-[11px]">{r.startDate} s/d {r.endDate}</span> },
    { key: "status", label: "Status", render: (r) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === "CLOSED" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{r.status}</span> },
    { key: "netIncome", label: "Laba Bersih", render: (r) => <span className={`font-mono text-[11px] font-bold ${r.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{r.status === "CLOSED" ? fmtRp(r.netIncome) : "-"}</span> },
    { key: "closingJournalId", label: "Jurnal Closing", render: (r) => <span className="font-mono text-[10px]">{r.closingJournalId || "-"}</span> },
    { key: "closedAt", label: "Ditutup", render: (r) => <span className="font-mono text-[10px]">{r.closedAt ? new Date(r.closedAt).toLocaleString("id-ID") : "-"}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Tutup Periode</span>
          <p className="text-[11px] text-slate-500">Closing bulanan — posting jurnal penutup ke Laba Ditahan</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Refresh</button>
          <button type="button" onClick={() => setModalOpen(true)} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Tutup Periode</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.periodId} emptyMessage="Belum ada periode ditutup." />

      <WarungModal open={modalOpen} title="Tutup Periode" onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bulan (YYYY-MM)</label>
            <input type="month" required value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
            <b>Perhatian:</b> Setelah ditutup, jurnal baru bertanggal dalam periode ini akan ditolak. Jurnal penutup juga diposting ke akun Laba Ditahan (3-3001). Aksi ini tidak bisa dibatalkan.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg">{submitting ? "Memproses..." : "Tutup Periode"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}