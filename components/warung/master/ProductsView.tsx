"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Product {
  productCode: string;
  famCode: string;
  familyName: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  stockCategory: string;
  capitalPrice: number;
  sellingPrice: number;
  minStock: number;
  active: boolean;
  notes: string;
}

interface Family { famCode: string; familyName: string; active: boolean; }

const EMPTY_FORM = {
  famCode: "",
  name: "",
  sku: "",
  barcode: "",
  unit: "Pcs",
  stockCategory: "FISIK",
  capitalPrice: 0,
  sellingPrice: 0,
  minStock: 0,
  notes: "",
  active: true,
};

export default function ProductsView() {
  const [items, setItems] = useState<Product[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterFam, setFilterFam] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  async function loadFamilies() {
    try {
      const r = await fetch("/api/warung/families?active=true");
      const j = await r.json();
      if (j.success) setFamilies(j.data);
    } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filterFam) params.set("famCode", filterFam);
      const res = await fetch("/api/warung/products?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadFamilies(); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, famCode: families[0]?.famCode || "" });
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      famCode: p.famCode,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      unit: p.unit,
      stockCategory: p.stockCategory,
      capitalPrice: p.capitalPrice,
      sellingPrice: p.sellingPrice,
      minStock: p.minStock,
      notes: p.notes,
      active: p.active,
    });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const isNew = !editing;
      const url = isNew ? "/api/warung/products" : `/api/warung/products/${encodeURIComponent(editing.productCode)}`;
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

  async function remove(p: Product) {
    if (!confirm(`Hapus produk ${p.productCode} - ${p.name}?`)) return;
    try {
      const res = await fetch(`/api/warung/products/${encodeURIComponent(p.productCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message || "Dihapus." });
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
  }

  const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

  const columns: Column<Product>[] = [
    { key: "productCode", label: "Kode", render: (r) => <span className="font-mono font-bold text-slate-900">{r.productCode}</span> },
    { key: "name", label: "Nama Produk", render: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "familyName", label: "Family", render: (r) => <span className="text-[11px]">{r.famCode} - {r.familyName}</span> },
    { key: "unit", label: "Unit", render: (r) => <span className="font-mono">{r.unit}</span> },
    { key: "capitalPrice", label: "HPP", render: (r) => <span className="font-mono text-[11px]">{formatRp(r.capitalPrice)}</span> },
    { key: "sellingPrice", label: "Harga Jual", render: (r) => <span className="font-mono font-bold text-emerald-700 text-[11px]">{formatRp(r.sellingPrice)}</span> },
    { key: "minStock", label: "Min", render: (r) => <span className="font-mono">{r.minStock}</span> },
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
          <span className="text-xs font-bold text-slate-900 uppercase">Master Produk</span>
          <p className="text-[11px] text-slate-500">Katalog produk warung</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filterFam} onChange={(e) => setFilterFam(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Semua Family</option>
            {families.map((f) => <option key={f.famCode} value={f.famCode}>{f.famCode} - {f.familyName}</option>)}
          </select>
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari kode/nama/SKU..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Tambah Produk</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.productCode} emptyMessage="Belum ada produk." />

      <WarungModal open={modalOpen} title={editing ? `Edit Produk ${editing.productCode}` : "Tambah Produk"} onClose={() => setModalOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={submit} className="space-y-3">
          {!editing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Family</label>
              <select required value={form.famCode} onChange={(e) => setForm({ ...form, famCode: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">-- pilih family --</option>
                {families.map((f) => <option key={f.famCode} value={f.famCode}>{f.famCode} - {f.familyName}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Produk *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan (Unit)</label>
              <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Pcs, Box, Kg..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU (opsional, unik)</label>
              <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode (opsional)</label>
              <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">HPP</label>
              <input type="number" min={0} value={form.capitalPrice} onChange={(e) => setForm({ ...form, capitalPrice: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Jual</label>
              <input type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Stok</label>
              <input type="number" step={1} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Stok</label>
            <select value={form.stockCategory} onChange={(e) => setForm({ ...form, stockCategory: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="FISIK">FISIK (stok dihitung)</option>
              <option value="JASA">JASA (tanpa stok)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="prod-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="prod-active" className="text-xs font-semibold text-slate-700">Aktif</label>
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