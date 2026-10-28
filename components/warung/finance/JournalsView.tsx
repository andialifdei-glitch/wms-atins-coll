"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface JournalEntry { coaCode: string; coaName: string; debit: number; credit: number; }
interface Journal {
  journalId: string;
  journalDate: string;
  description: string;
  refType: string;
  refId: string;
  entries: JournalEntry[];
  totalDebit: number;
  totalCredit: number;
  status: string;
  voidOfJournalId: string;
  createdAt: string;
  createdBy: string;
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

const REF_LABEL = (r: string) => {
  switch (r) {
    case "CASH_IN": return "Kas Masuk";
    case "CASH_OUT": return "Kas Keluar";
    case "CASH_VOID": return "Void Kas";
    case "RECEIVABLE_CREATE": return "Piutang Baru";
    case "RECEIVABLE_PAYMENT": return "Bayar Piutang";
    case "PAYABLE_CREATE": return "Utang Baru";
    case "PAYABLE_PAYMENT": return "Bayar Utang";
    default: return r;
  }
};

export default function JournalsView() {
  const [items, setItems] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Journal | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch("/api/warung/journals?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openDetail(jj: Journal) { setDetail(jj); setDetailOpen(true); }

  const statusColor = (s: string) => s === "VOID" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800";

  const columns: Column<Journal>[] = [
    { key: "journalId", label: "Jurnal ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.journalId}</span> },
    { key: "journalDate", label: "Tanggal", render: (r) => <span className="font-mono text-[11px]">{r.journalDate}</span> },
    { key: "description", label: "Keterangan", render: (r) => <span className="text-[11px]">{r.description}</span> },
    { key: "refType", label: "Ref", render: (r) => <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{REF_LABEL(r.refType)}</span> },
    { key: "totalDebit", label: "Total", render: (r) => <span className="font-mono text-[11px] font-bold text-emerald-700">{fmtRp(r.totalDebit)}</span> },
    { key: "status", label: "Status", render: (r) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor(r.status)}`}>{r.status || "POSTED"}</span> },
    { key: "actions", label: "Aksi", render: (r) => (
      <button type="button" onClick={() => openDetail(r)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Detail</button>
    )},
  ];

  const entryColumns: Column<JournalEntry>[] = [
    { key: "coaCode", label: "Kode", render: (r) => <span className="font-mono font-bold">{r.coaCode}</span> },
    { key: "coaName", label: "Akun" },
    { key: "debit", label: "Debit", render: (r) => <span className="font-mono text-right block">{r.debit ? fmtRp(r.debit) : "-"}</span>, className: "text-right" },
    { key: "credit", label: "Kredit", render: (r) => <span className="font-mono text-right block">{r.credit ? fmtRp(r.credit) : "-"}</span>, className: "text-right" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Jurnal Umum</span>
          <p className="text-[11px] text-slate-500">Double-entry ledger</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" title="Dari" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs" title="Sampai" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Status</option>
            <option value="POSTED">POSTED</option>
            <option value="VOID">VOID</option>
          </select>
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari jurnal/ref..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.journalId} emptyMessage="Belum ada jurnal." />

      <WarungModal open={detailOpen} title={detail ? `Jurnal ${detail.journalId}` : "Detail"} onClose={() => setDetailOpen(false)} maxWidth="max-w-2xl">
        {detail ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>Tanggal: <b className="font-mono">{detail.journalDate}</b></div>
              <div>Ref: <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">{REF_LABEL(detail.refType)}</span> {detail.refId && <span className="font-mono">{detail.refId}</span>}</div>
              <div className="col-span-2">Keterangan: {detail.description}</div>
            </div>

            <WarungDataTable columns={entryColumns} data={detail.entries} rowKey={(r) => r.coaCode} />

            <div className="flex justify-end gap-6 pt-2 border-t border-slate-200">
              <div>Total Debit: <b className="font-mono text-emerald-700">{fmtRp(detail.totalDebit)}</b></div>
              <div>Total Kredit: <b className="font-mono text-rose-700">{fmtRp(detail.totalCredit)}</b></div>
            </div>
          </div>
        ) : <div className="text-slate-400">-</div>}
      </WarungModal>
    </div>
  );
}