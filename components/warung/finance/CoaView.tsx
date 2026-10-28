"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Coa {
  coaCode: string;
  coaName: string;
  type: string;
  normalBalance: string;
  active: boolean;
  isSystem: boolean;
  notes: string;
}

const TYPES = ["ASET", "KEWAJIBAN", "EKUITAS", "PENDAPATAN", "BEBAN"];

const TYPE_COLOR = (t: string) => {
  switch (t) {
    case "ASET": return "bg-emerald-100 text-emerald-800";
    case "KEWAJIBAN": return "bg-rose-100 text-rose-800";
    case "EKUITAS": return "bg-sky-100 text-sky-800";
    case "PENDAPATAN": return "bg-amber-100 text-amber-800";
    case "BEBAN": return "bg-purple-100 text-purple-800";
    default: return "bg-slate-100 text-slate-800";
  }
};

export default function CoaView() {
  const [items, setItems] = useState<Coa[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coa | null>(null);
  const [form, setForm] = useState({ coaCode: "", coaName: "", type: "ASET", normalBalance: "DEBIT", active: true, notes: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filterType) params.set("type", filterType);
      const res = await fetch("/api/warung/coa?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditing(null);
    setForm({ coaCode: "", coaName: "", type: "ASET", normalBalance: "DEBIT", active: true, notes: "" });
    setModalOpen(true);
  }
  function openEdit(c: Coa) {
    setEditing(c);
    setForm({ coaCode: c.coaCode, coaName: c.coaName, type: c.type, normalBalance: c.normalBalance, active: c.active, notes: c.notes });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isNew = !editing;
      const url = isNew ? "/api/warung/coa" : `/api/warung/coa/${encodeURIComponent(editing.coaCode)}`;
      const body: any = { coaName: form.coaName, notes: form.notes, active: form.active };
      if (isNew) { body.coaCode = form.coaCode; body.type = form.type; body.normalBalance = form.normalBalance; }
      else if (!editing.isSystem) { body.type = form.type; body.normalBalance = form.normalBalance; }
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setModalOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  async function remove(c: Coa) {
    if (c.isSystem) { setMsg({ type: "error", text: "Akun sistem tidak bisa dihapus." }); return; }
    if (!confirm(`Hapus COA ${c.coaCode} - ${c.coaName}?`)) return;
    try {
      const res = await fetch(`/api/warung/coa/${encodeURIComponent(c.coaCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
  }

  const columns: Column<Coa>[] = [
    { key: "coaCode", label: "Kode", render: (r) => <span className="font-mono font-bold text-slate-900">{r.coaCode}</span> },
    { key: "coaName", label: "Nama Akun", render: (r) => <span className="font-semibold">{r.coaName}{r.isSystem && <span className="ml-1 text-[9px] bg-slate-200 text-slate-700 px-1 rounded">SYS</span>}</span> },
    { key: "type", label: "Tipe", render: (r) => <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_COLOR(r.type)}`}>{r.type}</span> },
    { key: "normalBalance", label: "Saldo", render: (r) => <span className="font-mono text-[10px]">{r.normalBalance}</span> },
    { key: "active", label: "Status", render: (r) => r.active ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">AKTIF</span> : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">NONAKTIF</span> },
    { key: "actions", label: "Aksi", render: (r) => (
      <div className="space-x-1 whitespace-nowrap">
        <button type="button" onClick={() => openEdit(r)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Edit</button>
        {!r.isSystem && <button type="button" onClick={() => remove(r)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">Hapus</button>}
      </div>
    )},
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Chart of Accounts</span>
          <p className="text-[11px] text-slate-500">Master akun akuntansi</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Semua Tipe</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari kode/nama..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Tambah Akun</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.coaCode} emptyMessage="Belum ada akun." />

      <WarungModal open={modalOpen} title={editing ? `Edit Akun ${editing.coaCode}` : "Tambah Akun"} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          {!editing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Akun</label>
              <input type="text" required value={form.coaCode} onChange={(e) => setForm({ ...form, coaCode: e.target.value })} placeholder="1-1001" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Akun</label>
            <input type="text" required value={form.coaName} onChange={(e) => setForm({ ...form, coaName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe</label>
              <select disabled={editing?.isSystem} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Saldo Normal</label>
              <select disabled={editing?.isSystem} value={form.normalBalance} onChange={(e) => setForm({ ...form, normalBalance: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100">
                <option value="DEBIT">DEBIT</option>
                <option value="KREDIT">KREDIT</option>
              </select>
            </div>
          </div>
          {editing?.isSystem && <p className="text-[10px] text-amber-700 italic">Akun sistem: tipe & saldo normal terkunci.</p>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="coa-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="coa-active" className="text-xs font-semibold text-slate-700">Aktif</label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg">{submitting ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}