"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Log { logId: string; category: string; action: string; entityId: string; entityLabel: string; amount: number; journalId: string; actorName: string; notes: string; createdAt: string; }

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const CAT_LABEL: Record<string, string> = { COA: "COA", JOURNAL: "Jurnal", CASH_FLOW: "Kas", RECEIVABLE: "Piutang", PAYABLE: "Utang" };
const ACT_LABEL: Record<string, string> = { CREATE: "Buat", UPDATE: "Ubah", DELETE: "Hapus", POST: "Posting", PAY: "Bayar", VOID: "Void" };

export default function ActivityLogView() {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterAct, setFilterAct] = useState("");

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (filterCat) p.set("category", filterCat);
      if (filterAct) p.set("action", filterAct);
      const res = await fetch("/api/warung/activity-logs?" + p.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const columns: Column<Log>[] = [
    { key: "createdAt", label: "Waktu", render: (r) => <span className="text-[10px] font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"}</span> },
    { key: "category", label: "Kategori", render: (r) => <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">{CAT_LABEL[r.category] || r.category}</span> },
    { key: "action", label: "Aksi", render: (r) => <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">{ACT_LABEL[r.action] || r.action}</span> },
    { key: "entityLabel", label: "Keterangan", render: (r) => <span className="text-[11px]">{r.entityLabel || r.entityId}</span> },
    { key: "amount", label: "Nominal", render: (r) => <span className="font-mono text-[11px]">{r.amount ? fmtRp(r.amount) : "-"}</span> },
    { key: "actorName", label: "Oleh", render: (r) => <span className="text-[10px]">{r.actorName || "-"}</span> },
    { key: "journalId", label: "Jurnal", render: (r) => <span className="font-mono text-[10px] text-slate-500">{r.journalId || "-"}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Log Aktivitas</span>
          <p className="text-[11px] text-slate-500">Audit trail pencatatan keuangan</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Kategori</option>
            <option value="COA">COA</option>
            <option value="JOURNAL">Jurnal</option>
            <option value="CASH_FLOW">Kas</option>
            <option value="RECEIVABLE">Piutang</option>
            <option value="PAYABLE">Utang</option>
          </select>
          <select value={filterAct} onChange={(e) => setFilterAct(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Aksi</option>
            <option value="CREATE">Buat</option>
            <option value="UPDATE">Ubah</option>
            <option value="DELETE">Hapus</option>
            <option value="POST">Posting</option>
            <option value="PAY">Bayar</option>
            <option value="VOID">Void</option>
          </select>
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari entitas/aktor..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
        </div>
      </div>

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.logId} emptyMessage="Belum ada log." />
    </div>
  );
}