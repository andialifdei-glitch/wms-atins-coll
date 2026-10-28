"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";

interface LogEntry { action: string; at: string; by: string; amount?: number; notes?: string; }

interface CashCount {
  ccId: string;
  countDate: string;
  label: string;
  openingAmount: number;
  openingAt: string;
  openingBy: string;
  closingAmount: number;
  closingAt: string;
  closingBy: string;
  expectedCash: number;
  variance: number;
  varianceReason: string;
  notes: string;
  logs: LogEntry[];
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function CashCountView() {
  const [items, setItems] = useState<CashCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ countDate: new Date().toISOString().slice(0, 10), openingAmount: 0, notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<CashCount | null>(null);
  const [closingForm, setClosingForm] = useState({ closingAmount: 0, expectedCash: 0, varianceReason: "", notes: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/warung/cash-count", { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/cash-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setCreateOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  async function openDetail(cc: CashCount) {
    setDetail(cc);
    setClosingForm({
      closingAmount: cc.closingAmount || 0,
      expectedCash: cc.expectedCash || 0,
      varianceReason: cc.varianceReason || "",
      notes: cc.notes || "",
    });
    setDetailOpen(true);
  }

  async function doAction(action: "UPDATE_OPENING" | "CLOSE") {
    if (!detail) return;
    setSubmitting(true);
    try {
      const body = action === "CLOSE"
        ? { action, closingAmount: closingForm.closingAmount, expectedCash: closingForm.expectedCash, varianceReason: closingForm.varianceReason, notes: closingForm.notes }
        : { action, openingAmount: detail.openingAmount, notes: detail.notes };
      const res = await fetch(`/api/warung/cash-count/${encodeURIComponent(detail.ccId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setDetailOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  const labelColor = (label: string) => label === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";

  const columns: Column<CashCount>[] = [
    { key: "ccId", label: "CC ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.ccId}</span> },
    { key: "countDate", label: "Tanggal", render: (r) => <span className="font-mono text-[11px]">{r.countDate}</span> },
    { key: "label", label: "Status", render: (r) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${labelColor(r.label)}`}>{r.label}</span> },
    { key: "openingAmount", label: "Opening", render: (r) => <span className="font-mono text-[11px]">{fmtRp(r.openingAmount)}</span> },
    { key: "closingAmount", label: "Closing", render: (r) => <span className="font-mono text-[11px]">{r.closingAmount ? fmtRp(r.closingAmount) : "-"}</span> },
    { key: "variance", label: "Selisih", render: (r) => {
      if (r.label !== "COMPLETED") return <span className="text-slate-400">-</span>;
      const c = r.variance > 0 ? "text-emerald-700" : r.variance < 0 ? "text-rose-700" : "text-slate-500";
      return <span className={`font-mono text-[11px] font-bold ${c}`}>{fmtRp(r.variance)}</span>;
    }},
    { key: "actions", label: "Aksi", render: (r) => (
      <button type="button" onClick={() => openDetail(r)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Buka</button>
    )},
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Cash Count</span>
          <p className="text-[11px] text-slate-500">Buka & tutup kas harian (satu ID per tanggal)</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Buka Kas</button>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.ccId} emptyMessage="Belum ada cash count." />

      <WarungModal open={createOpen} title="Buka Kas (Opening)" onClose={() => setCreateOpen(false)}>
        <form onSubmit={submitCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
            <input type="date" required value={createForm.countDate} onChange={(e) => setCreateForm({ ...createForm, countDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Saldo Awal (Opening)</label>
            <input type="number" min={0} step={1} required value={createForm.openingAmount} onChange={(e) => setCreateForm({ ...createForm, openingAmount: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg">{submitting ? "Menyimpan..." : "Buka Kas"}</button>
          </div>
        </form>
      </WarungModal>

      <WarungModal open={detailOpen} title={detail ? `Cash Count ${detail.ccId}` : "Detail"} onClose={() => setDetailOpen(false)} maxWidth="max-w-3xl">
        {detail ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>Tanggal: <b className="font-mono">{detail.countDate}</b></div>
              <div>Status: <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${labelColor(detail.label)}`}>{detail.label}</span></div>
              <div>Opening: <b className="font-mono">{fmtRp(detail.openingAmount)}</b> ({detail.openingAt ? new Date(detail.openingAt).toLocaleString("id-ID") : "-"})</div>
              {detail.label === "COMPLETED" && (
                <>
                  <div>Closing: <b className="font-mono">{fmtRp(detail.closingAmount)}</b> ({detail.closingAt ? new Date(detail.closingAt).toLocaleString("id-ID") : "-"})</div>
                  <div>Expected: <b className="font-mono">{fmtRp(detail.expectedCash)}</b></div>
                  <div>Selisih: <b className={`font-mono ${detail.variance > 0 ? "text-emerald-700" : detail.variance < 0 ? "text-rose-700" : ""}`}>{fmtRp(detail.variance)}</b></div>
                  <div>Alasan selisih: {detail.varianceReason || "-"}</div>
                </>
              )}
            </div>

            {detail.label === "OPEN" && (
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="text-[11px] uppercase font-bold text-rose-700">Closing</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Kas Seharusnya (expected)</label>
                    <input type="number" min={0} step={1} value={closingForm.expectedCash} onChange={(e) => setClosingForm({ ...closingForm, expectedCash: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Kas Aktual (closing)</label>
                    <input type="number" min={0} step={1} value={closingForm.closingAmount} onChange={(e) => setClosingForm({ ...closingForm, closingAmount: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">Alasan selisih (jika ada)</label>
                  <input type="text" value={closingForm.varianceReason} onChange={(e) => setClosingForm({ ...closingForm, varianceReason: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <button type="button" onClick={() => doAction("CLOSE")} disabled={submitting} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold">{submitting ? "..." : "Close Kas"}</button>
              </div>
            )}

            <div className="border-t border-slate-200 pt-2">
              <div className="text-[11px] uppercase font-bold text-slate-700 mb-1">Log</div>
              <div className="max-h-[180px] overflow-y-auto space-y-1">
                {detail.logs.map((log, i) => (
                  <div key={i} className="text-[10px] border-l-2 border-amber-400 pl-2">
                    <b>{log.action}</b> — {log.at ? new Date(log.at).toLocaleString("id-ID") : "-"} — oleh {log.by}
                    {log.amount !== undefined && log.amount !== 0 ? ` (${fmtRp(log.amount)})` : ""}
                    {log.notes ? ` — ${log.notes}` : ""}
                  </div>
                ))}
                {detail.logs.length === 0 && <div className="text-[10px] text-slate-400">Belum ada log.</div>}
              </div>
            </div>
          </div>
        ) : <div className="text-xs text-slate-400">-</div>}
      </WarungModal>
    </div>
  );
}