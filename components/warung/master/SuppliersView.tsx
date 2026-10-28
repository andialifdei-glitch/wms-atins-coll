"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Supplier {
  supplierCode: string;
  supplierName: string;
  phone: string;
  address: string;
  contactPerson: string;
  email: string;
  notes: string;
  active: boolean;
}

const EMPTY_FORM = { supplierName: "", phone: "", address: "", contactPerson: "", email: "", notes: "", active: true };

export default function SuppliersView() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/warung/suppliers?q=" + encodeURIComponent(q), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ supplierName: s.supplierName, phone: s.phone, address: s.address, contactPerson: s.contactPerson, email: s.email, notes: s.notes, active: s.active });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const isNew = !editing;
      const url = isNew ? "/api/warung/suppliers" : `/api/warung/suppliers/${encodeURIComponent(editing.supplierCode)}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message || "Berhasil." });
      setModalOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  async function remove(s: Supplier) {
    if (!confirm(`Hapus supplier ${s.supplierCode} - ${s.supplierName}?`)) return;
    try {
      const res = await fetch(`/api/warung/suppliers/${encodeURIComponent(s.supplierCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message || "Dihapus." });
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
  }

  const columns: Column<Supplier>[] = [
    { key: "supplierCode", label: "Kode", render: (r) => <span className="font-mono font-bold text-slate-900">{r.supplierCode}</span> },
    { key: "supplierName", label: "Nama Supplier" },
    { key: "phone", label: "Telepon", render: (r) => <span className="font-mono">{r.phone || "-"}</span> },
    { key: "contactPerson", label: "Kontak", render: (r) => r.contactPerson || "-" },
    { key: "address", label: "Alamat", render: (r) => <span className="text-[11px]">{r.address || "-"}</span> },
    { key: "active", label: "Status", render: (r) => r.active ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">AKTIF</span> : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">NONAKTIF</span> },
    { key: "actions", label: "Aksi", render: (r) => (
      <div className="space-x-1 whitespace-nowrap">
        <button type="button" onClick={() => openEdit(r)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Edit</button>
        <button type="button" onClick={() => remove(r)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">Hapus</button>
      </div>
    )},
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Master Supplier</span>
          <p className="text-[11px] text-slate-500">Supplier / vendor pembelian</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari kode/nama/telepon..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Tambah</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.supplierCode} emptyMessage="Belum ada supplier." />

      <WarungModal open={modalOpen} title={editing ? `Edit Supplier ${editing.supplierCode}` : "Tambah Supplier"} onClose={() => setModalOpen(false)} maxWidth="max-w-lg">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Supplier *</label>
            <input type="text" required value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telepon</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sup-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="sup-active" className="text-xs font-semibold text-slate-700">Aktif</label>
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