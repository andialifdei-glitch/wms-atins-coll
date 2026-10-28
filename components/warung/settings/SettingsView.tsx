"use client";

import React, { useEffect, useState } from "react";

interface StoreInfo {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  storeNpwp: string;
  storeNotes: string;
  receiptFooter: string;
}

const EMPTY: StoreInfo = { storeName: "", storeAddress: "", storePhone: "", storeEmail: "", storeNpwp: "", storeNotes: "", receiptFooter: "" };

const NUMBERING_PREVIEW = [
  { prefix: "PO", example: "PO-YYYYMMDD-001", desc: "Purchase Order" },
  { prefix: "RCV", example: "RCV-YYYYMMDD-001", desc: "Receiving" },
  { prefix: "RTR", example: "RTR-YYYYMMDD-001", desc: "Retur Pembelian" },
  { prefix: "CF", example: "CF-YYYYMMDD-001", desc: "Kas Masuk/Keluar" },
  { prefix: "AR", example: "AR-YYYYMMDD-001", desc: "Piutang" },
  { prefix: "AP", example: "AP-YYYYMMDD-001", desc: "Utang" },
  { prefix: "SOP", example: "SOP-YYYYMMDD-001", desc: "Stock Opname" },
  { prefix: "IP", example: "IP-YYYYMMDD-001", desc: "Adjustment IP" },
  { prefix: "BRK", example: "BRK-YYYYMMDD-001", desc: "Breakage" },
  { prefix: "CC", example: "CC-YYYYMMDD", desc: "Cash Count (per hari)" },
  { prefix: "JU", example: "JU-YYYYMMDD-001", desc: "Jurnal Umum" },
  { prefix: "PRD", example: "PRD-{famCode}-001", desc: "Kode Produk per family" },
  { prefix: "SUPP", example: "SUPP-001", desc: "Supplier" },
  { prefix: "CUST", example: "CUST-0001", desc: "Customer (dari WMS)" },
];

export default function SettingsView() {
  const [form, setForm] = useState<StoreInfo>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/warung/settings");
      const j = await r.json();
      if (j.success) setForm(j.data);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/warung/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Profil Usaha Warung</span>
          <p className="text-[11px] text-slate-500">Identitas warung yang dipakai di struk & dokumen</p>
        </div>

        {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Warung *</label>
            <input type="text" required value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Telepon</label>
            <input type="text" value={form.storePhone} onChange={(e) => setForm({ ...form, storePhone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Alamat</label>
            <textarea value={form.storeAddress} onChange={(e) => setForm({ ...form, storeAddress: e.target.value })} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email</label>
            <input type="email" value={form.storeEmail} onChange={(e) => setForm({ ...form, storeEmail: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">NPWP</label>
            <input type="text" value={form.storeNpwp} onChange={(e) => setForm({ ...form, storeNpwp: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Catatan Internal</label>
            <textarea value={form.storeNotes} onChange={(e) => setForm({ ...form, storeNotes: e.target.value })} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Footer Struk</label>
            <textarea value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} rows={2} placeholder="Terima kasih telah berbelanja..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={load} disabled={saving || loading} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Reset</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg">{saving ? "Menyimpan..." : "Simpan Pengaturan"}</button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Preview Nomor Dokumen</span>
          <p className="text-[11px] text-slate-500">Format nomor otomatis per modul (counter per hari)</p>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="text-left p-2">Modul</th>
              <th className="text-left p-2">Prefix</th>
              <th className="text-left p-2">Contoh Format</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {NUMBERING_PREVIEW.map((n) => (
              <tr key={n.prefix}>
                <td className="p-2">{n.desc}</td>
                <td className="p-2 font-mono font-bold">{n.prefix}</td>
                <td className="p-2 font-mono text-slate-600">{n.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}