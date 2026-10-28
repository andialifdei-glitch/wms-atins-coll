"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";

interface IpDoc {
  txId: string;
  sourceProductCode: string;
  sourceQty: number;
  targetProductCode: string;
  targetQty: number;
  notes: string;
  createdAt: string;
  createdBy: string;
}

interface Product { productCode: string; name: string; }

export default function AdjustmentIpView() {
  const [items, setItems] = useState<IpDoc[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ sourceProductCode: "", sourceQty: 1, targetProductCode: "", targetQty: 1, notes: "" });
  const [submitting, setSubmitting] = useState(false);

  async function loadProducts() {
    try {
      const r = await fetch("/api/warung/products?active=true");
      const j = await r.json();
      if (j.success) setProducts(j.data);
    } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/warung/adjustment-ip", { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadProducts(); load(); }, []);

  function openCreate() {
    setForm({ sourceProductCode: "", sourceQty: 1, targetProductCode: "", targetQty: 1, notes: "" });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/adjustment-ip", {
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

  const columns: Column<IpDoc>[] = [
    { key: "txId", label: "ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.txId}</span> },
    { key: "source", label: "Source (keluar)", render: (r) => <span className="text-[11px]"><b>{r.sourceProductCode}</b> × {r.sourceQty}</span> },
    { key: "target", label: "Target (masuk)", render: (r) => <span className="text-[11px]"><b>{r.targetProductCode}</b> × {r.targetQty}</span> },
    { key: "notes", label: "Catatan", render: (r) => <span className="text-[10px]">{r.notes || "-"}</span> },
    { key: "createdAt", label: "Dibuat", render: (r) => <span className="text-[10px] font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Adjustment IP</span>
          <p className="text-[11px] text-slate-500">Konversi produk (misal 1 Box → 10 Pcs)</p>
        </div>
        <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Buat IP</button>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.txId} emptyMessage="Belum ada adjustment IP." />

      <WarungModal open={modalOpen} title="Buat Adjustment IP" onClose={() => setModalOpen(false)} maxWidth="max-w-lg">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Produk Source (keluar)</label>
            <select required value={form.sourceProductCode} onChange={(e) => setForm({ ...form, sourceProductCode: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">-- pilih --</option>
              {products.map((p) => <option key={p.productCode} value={p.productCode}>{p.productCode} - {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Qty Source</label>
            <input type="number" min={1} step={1} required value={form.sourceQty} onChange={(e) => setForm({ ...form, sourceQty: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Produk Target (masuk)</label>
            <select required value={form.targetProductCode} onChange={(e) => setForm({ ...form, targetProductCode: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">-- pilih --</option>
              {products.map((p) => <option key={p.productCode} value={p.productCode}>{p.productCode} - {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Qty Target</label>
            <input type="number" min={1} step={1} required value={form.targetQty} onChange={(e) => setForm({ ...form, targetQty: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg">{submitting ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}