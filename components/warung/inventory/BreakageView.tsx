"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";

interface Breakage {
  breakageId: string;
  productCode: string;
  productName: string;
  qty: number;
  costPerUnit: number;
  totalCost: number;
  reason: string;
  notes: string;
  createdAt: string;
  createdBy: string;
}

interface Product { productCode: string; name: string; }

export default function BreakageView() {
  const [items, setItems] = useState<Breakage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ productCode: "", qty: 1, reason: "", notes: "" });
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
      const res = await fetch("/api/warung/breakage", { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadProducts(); load(); }, []);

  function openCreate() {
    setForm({ productCode: "", qty: 1, reason: "", notes: "" });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/breakage", {
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

  const formatRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

  const columns: Column<Breakage>[] = [
    { key: "breakageId", label: "ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.breakageId}</span> },
    { key: "productCode", label: "Produk", render: (r) => <span className="text-[11px]"><b>{r.productCode}</b> {r.productName}</span> },
    { key: "qty", label: "Qty", render: (r) => <span className="font-mono text-rose-700">-{r.qty}</span> },
    { key: "totalCost", label: "Nilai Susut", render: (r) => <span className="font-mono text-[11px]">{formatRp(r.totalCost)}</span> },
    { key: "reason", label: "Alasan", render: (r) => <span className="text-[10px]">{r.reason || "-"}</span> },
    { key: "createdAt", label: "Tanggal", render: (r) => <span className="text-[10px] font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Breakage / Susut</span>
          <p className="text-[11px] text-slate-500">Catat kerusakan, susut, expired</p>
        </div>
        <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Catat Susut</button>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.breakageId} emptyMessage="Belum ada catatan breakage." />

      <WarungModal open={modalOpen} title="Catat Breakage" onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Produk</label>
            <select required value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">-- pilih --</option>
              {products.map((p) => <option key={p.productCode} value={p.productCode}>{p.productCode} - {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Qty (harus ≤ stok)</label>
            <input type="number" min={1} step={1} required value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan</label>
            <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">-- pilih --</option>
              <option value="RUSAK">Rusak</option>
              <option value="EXPIRED">Expired</option>
              <option value="HILANG">Hilang</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg">{submitting ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}