"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Division {
  divCode: string;
  divName: string;
  active: boolean;
}

export default function DivisionsView() {
  const [items, setItems] = useState<Division[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Division | null>(null);
  const [form, setForm] = useState({ divCode: "", divName: "", active: true });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/warung/divisions?q=" + encodeURIComponent(q), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) {
      setMsg({ type: "error", text: e.message });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditing(null);
    setForm({ divCode: "", divName: "", active: true });
    setModalOpen(true);
  }

  function openEdit(d: Division) {
    setEditing(d);
    setForm({ divCode: d.divCode, divName: d.divName, active: d.active });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const isNew = !editing;
      const url = isNew
        ? "/api/warung/divisions"
        : `/api/warung/divisions/${encodeURIComponent(editing.divCode)}`;
      const body: any = { divName: form.divName, active: form.active };
      if (isNew) body.divCode = form.divCode;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message || "Berhasil." });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setMsg({ type: "error", text: e.message });
    } finally { setSubmitting(false); }
  }

  async function remove(d: Division) {
    if (!confirm(`Hapus divisi ${d.divCode} - ${d.divName}?`)) return;
    try {
      const res = await fetch(`/api/warung/divisions/${encodeURIComponent(d.divCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message || "Dihapus." });
      await load();
    } catch (e: any) {
      setMsg({ type: "error", text: e.message });
    }
  }

  const columns: Column<Division>[] = [
    { key: "divCode", label: "Kode", render: (r) => <span className="font-mono font-bold text-slate-900">{r.divCode}</span> },
    { key: "divName", label: "Nama Divisi" },
    { key: "active", label: "Status", render: (r) => r.active ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">AKTIF</span> : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">NONAKTIF</span> },
    {
      key: "actions",
      label: "Aksi",
      render: (r) => (
        <div className="space-x-1 whitespace-nowrap">
          <button type="button" onClick={() => openEdit(r)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Edit</button>
          <button type="button" onClick={() => remove(r)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">Hapus</button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Master Divisi</span>
          <p className="text-[11px] text-slate-500">Kelompok besar usaha</p>
        </div>
        <div className="flex gap-2">
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari kode/nama..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Tambah</button>
        </div>
      </div>

      {msg && (
        <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.divCode} emptyMessage="Belum ada divisi. Klik + Tambah." />

      <WarungModal
        open={modalOpen}
        title={editing ? `Edit Divisi ${editing.divCode}` : "Tambah Divisi"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={submit} className="space-y-3">
          {!editing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kode (1 digit 0-9)</label>
              <input type="text" required minLength={1} maxLength={1} value={form.divCode} onChange={(e) => setForm({ ...form, divCode: e.target.value.replace(/\D/g, "") })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Divisi</label>
            <input type="text" required value={form.divName} onChange={(e) => setForm({ ...form, divName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="div-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="div-active" className="text-xs font-semibold text-slate-700">Aktif</label>
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