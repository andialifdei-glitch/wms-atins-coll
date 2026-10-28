"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface CashFlow {
  cfId: string;
  flowDate: string;
  flowType: string;
  amount: number;
  category: string;
  counterAccount: string;
  counterAccountName: string;
  notes: string;
  journalId: string;
  status: string;
  voidJournalId: string;
  createdAt: string;
  createdBy: string;
}

interface Coa { coaCode: string; coaName: string; type: string; active: boolean; }

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function CashFlowsView() {
  const [items, setItems] = useState<CashFlow[]>([]);
  const [coaList, setCoaList] = useState<Coa[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ flowDate: new Date().toISOString().slice(0, 10), flowType: "IN", amount: 0, category: "", counterAccount: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  async function loadCoa() {
    try {
      const r = await fetch("/api/warung/coa?active=true");
      const j = await r.json();
      if (j.success) setCoaList(j.data.filter((c: Coa) => c.coaCode !== "1-1001")); // exclude Kas sendiri
    } catch {}
  }
  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filterType) params.set("flowType", filterType);
      const res = await fetch("/api/warung/cash-flows?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadCoa(); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate(type: "IN" | "OUT") {
    setForm({ flowDate: new Date().toISOString().slice(0, 10), flowType: type, amount: 0, category: "", counterAccount: "", notes: "" });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.counterAccount) { setMsg({ type: "error", text: "Pilih akun lawan." }); return; }
    if (form.amount <= 0) { setMsg({ type: "error", text: "Amount harus > 0." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/cash-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setModalOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  async function voidFlow(cf: CashFlow) {
    if (cf.status === "VOID") { setMsg({ type: "error", text: "Sudah VOID." }); return; }
    if (!confirm(`Void kas ${cf.cfId}? Jurnal koreksi akan diposting.`)) return;
    try {
      const res = await fetch(`/api/warung/cash-flows/${encodeURIComponent(cf.cfId)}`, {
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

  const columns: Column<CashFlow>[] = [
    { key: "cfId", label: "ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.cfId}</span> },
    { key: "flowDate", label: "Tanggal", render: (r) => <span className="font-mono text-[11px]">{r.flowDate}</span> },
    { key: "flowType", label: "Tipe", render: (r) => r.flowType === "IN" ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">MASUK</span> : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">KELUAR</span> },
    { key: "amount", label: "Nominal", render: (r) => <span className={`font-mono font-bold ${r.flowType === "IN" ? "text-emerald-700" : "text-rose-700"} text-[11px]`}>{r.flowType === "IN" ? "+" : "-"}{fmtRp(r.amount)}</span> },
    { key: "counterAccountName", label: "Akun Lawan", render: (r) => <span className="text-[11px]">{r.counterAccount} - {r.counterAccountName}</span> },
    { key: "category", label: "Kategori", render: (r) => <span className="text-[10px]">{r.category || "-"}</span> },
    { key: "status", label: "Status", render: (r) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === "VOID" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{r.status || "POSTED"}</span> },
    { key: "actions", label: "Aksi", render: (r) => r.status !== "VOID" ? (
      <button type="button" onClick={() => voidFlow(r)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">Void</button>
    ) : <span className="text-[10px] text-slate-400">-</span>},
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Kas Masuk / Keluar</span>
          <p className="text-[11px] text-slate-500">Arus kas operasional</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Semua Tipe</option>
            <option value="IN">Masuk</option>
            <option value="OUT">Keluar</option>
          </select>
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari id/catatan..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={() => openCreate("IN")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Masuk</button>
          <button type="button" onClick={() => openCreate("OUT")} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">- Keluar</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.cfId} emptyMessage="Belum ada kas." />

      <WarungModal open={modalOpen} title={form.flowType === "IN" ? "Kas Masuk" : "Kas Keluar"} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
              <input type="date" required value={form.flowDate} onChange={(e) => setForm({ ...form, flowDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nominal</label>
              <input type="number" min={1} step={1} required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Akun Lawan</label>
            <select required value={form.counterAccount} onChange={(e) => setForm({ ...form, counterAccount: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">-- pilih --</option>
              {coaList.map((c) => <option key={c.coaCode} value={c.coaCode}>{c.coaCode} - {c.coaName} ({c.type})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
            <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="misal: penjualan tunai, bayar listrik" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className={`px-4 py-2 text-xs font-bold text-white rounded-lg ${form.flowType === "IN" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}>{submitting ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}