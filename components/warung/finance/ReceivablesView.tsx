"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface ArPayment { payId: string; payDate: string; amount: number; journalId: string; notes: string; }

interface Ar {
  arId: string;
  customerName: string;
  arDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  notes: string;
  createJournalId: string;
  payments: ArPayment[];
  createdAt: string;
  createdBy: string;
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

const statusColor = (s: string) => {
  switch (s) {
    case "OPEN": return "bg-amber-100 text-amber-800";
    case "PARTIAL": return "bg-sky-100 text-sky-800";
    case "PAID": return "bg-emerald-100 text-emerald-800";
    case "CANCELLED": return "bg-rose-100 text-rose-800";
    default: return "bg-slate-100 text-slate-800";
  }
};

export default function ReceivablesView() {
  const [items, setItems] = useState<Ar[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ customerName: "", arDate: new Date().toISOString().slice(0, 10), dueDate: "", amount: 0, notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Ar | null>(null);
  const [payForm, setPayForm] = useState({ payAmount: 0, payDate: new Date().toISOString().slice(0, 10), notes: "" });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch("/api/warung/receivables?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setCreateForm({ customerName: "", arDate: new Date().toISOString().slice(0, 10), dueDate: "", amount: 0, notes: "" });
    setCreateOpen(true);
  }
  function openDetail(ar: Ar) {
    setDetail(ar);
    setPayForm({ payAmount: ar.remainingAmount, payDate: new Date().toISOString().slice(0, 10), notes: "" });
    setDetailOpen(true);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.customerName) { setMsg({ type: "error", text: "Customer wajib." }); return; }
    if (createForm.amount <= 0) { setMsg({ type: "error", text: "Amount harus > 0." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/receivables", {
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

  async function doPay() {
    if (!detail) return;
    if (payForm.payAmount <= 0) { setMsg({ type: "error", text: "Nominal harus > 0." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/warung/receivables/${encodeURIComponent(detail.arId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PAYMENT", ...payForm }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setDetailOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  async function doVoid(ar: Ar) {
    if (!confirm(`Void piutang ${ar.arId}?`)) return;
    try {
      const res = await fetch(`/api/warung/receivables/${encodeURIComponent(ar.arId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VOID" }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
  }

  const columns: Column<Ar>[] = [
    { key: "arId", label: "AR ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.arId}</span> },
    { key: "customerName", label: "Customer" },
    { key: "arDate", label: "Tgl", render: (r) => <span className="font-mono text-[10px]">{r.arDate}</span> },
    { key: "amount", label: "Nilai", render: (r) => <span className="font-mono text-[11px]">{fmtRp(r.amount)}</span> },
    { key: "remainingAmount", label: "Sisa", render: (r) => <span className={`font-mono text-[11px] font-bold ${r.remainingAmount > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmtRp(r.remainingAmount)}</span> },
    { key: "status", label: "Status", render: (r) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor(r.status)}`}>{r.status}</span> },
    { key: "actions", label: "Aksi", render: (r) => (
      <div className="space-x-1 whitespace-nowrap">
        <button type="button" onClick={() => openDetail(r)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Buka</button>
        {r.status !== "PAID" && r.status !== "CANCELLED" && r.paidAmount === 0 && (
          <button type="button" onClick={() => doVoid(r)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">Void</button>
        )}
      </div>
    )},
  ];

  const payColumns: Column<ArPayment>[] = [
    { key: "payDate", label: "Tanggal", render: (r) => <span className="font-mono text-[10px]">{r.payDate}</span> },
    { key: "amount", label: "Nominal", render: (r) => <span className="font-mono text-[11px]">{fmtRp(r.amount)}</span> },
    { key: "journalId", label: "Jurnal", render: (r) => <span className="font-mono text-[10px]">{r.journalId}</span> },
    { key: "notes", label: "Catatan", render: (r) => <span className="text-[10px]">{r.notes || "-"}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Piutang</span>
          <p className="text-[11px] text-slate-500">Piutang pelanggan</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Semua</option>
            <option value="OPEN">OPEN</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PAID">PAID</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari ar/customer..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Piutang Baru</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.arId} emptyMessage="Belum ada piutang." />

      <WarungModal open={createOpen} title="Piutang Baru" onClose={() => setCreateOpen(false)}>
        <form onSubmit={submitCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Customer</label>
            <input type="text" required value={createForm.customerName} onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tgl Piutang</label>
              <input type="date" value={createForm.arDate} onChange={(e) => setCreateForm({ ...createForm, arDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jatuh Tempo</label>
              <input type="date" value={createForm.dueDate} onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai</label>
              <input type="number" min={1} step={1} required value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg">{submitting ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </WarungModal>

      <WarungModal open={detailOpen} title={detail ? `Piutang ${detail.arId}` : "Detail"} onClose={() => setDetailOpen(false)} maxWidth="max-w-2xl">
        {detail ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>Customer: <b>{detail.customerName}</b></div>
              <div>Status: <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor(detail.status)}`}>{detail.status}</span></div>
              <div>Nilai: <b className="font-mono">{fmtRp(detail.amount)}</b></div>
              <div>Dibayar: <b className="font-mono">{fmtRp(detail.paidAmount)}</b></div>
              <div>Sisa: <b className="font-mono text-rose-700">{fmtRp(detail.remainingAmount)}</b></div>
              <div>Tgl: <b className="font-mono">{detail.arDate}</b></div>
            </div>

            <div>
              <div className="text-[11px] uppercase font-bold text-slate-700 mb-1">Riwayat Pembayaran</div>
              <WarungDataTable columns={payColumns} data={detail.payments} rowKey={(r) => r.payId} emptyMessage="Belum ada pembayaran." />
            </div>

            {detail.status !== "PAID" && detail.status !== "CANCELLED" && (
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="text-[11px] uppercase font-bold text-emerald-700">Catat Pembayaran</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">Tanggal</label>
                    <input type="date" value={payForm.payDate} onChange={(e) => setPayForm({ ...payForm, payDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Nominal (max {fmtRp(detail.remainingAmount)})</label>
                    <input type="number" min={1} max={detail.remainingAmount} step={1} value={payForm.payAmount} onChange={(e) => setPayForm({ ...payForm, payAmount: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600">Catatan</label>
                  <input type="text" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <button type="button" onClick={doPay} disabled={submitting} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold">{submitting ? "..." : "Simpan Pembayaran"}</button>
              </div>
            )}
          </div>
        ) : <div className="text-slate-400">-</div>}
      </WarungModal>
    </div>
  );
}