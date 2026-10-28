"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface RtrItem { productCode: string; productName: string; qty: number; cost: number; subtotal: number; }

interface Retur {
  rtrId: string;
  rcvId: string;
  supplierCode: string;
  supplierName: string;
  returnDate: string;
  items: RtrItem[];
  totalAmount: number;
  reason: string;
  notes: string;
  createdAt: string;
  createdBy: string;
}

interface Product { productCode: string; name: string; capitalPrice: number; active: boolean; }
interface Receiving { rcvId: string; poId: string; supplierName: string; }

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function PurchaseReturnsView() {
  const [items, setItems] = useState<Retur[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [receivings, setReceivings] = useState<Receiving[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ rcvId: "", returnDate: new Date().toISOString().slice(0, 10), reason: "", notes: "" });
  const [formItems, setFormItems] = useState<Array<{ productCode: string; qty: number; cost: number }>>([{ productCode: "", qty: 1, cost: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  async function loadRefs() {
    try {
      const [pRes, rRes] = await Promise.all([
        fetch("/api/warung/products?active=true"),
        fetch("/api/warung/receiving"),
      ]);
      const pj = await pRes.json();
      const rj = await rRes.json();
      if (pj.success) setProducts(pj.data);
      if (rj.success) setReceivings(rj.data);
    } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch("/api/warung/purchase-returns?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRefs(); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setForm({ rcvId: "", returnDate: new Date().toISOString().slice(0, 10), reason: "", notes: "" });
    setFormItems([{ productCode: "", qty: 1, cost: 0 }]);
    setModalOpen(true);
  }

  function updateItem(idx: number, patch: Partial<{ productCode: string; qty: number; cost: number }>) {
    setFormItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function addRow() { setFormItems((prev) => [...prev, { productCode: "", qty: 1, cost: 0 }]); }
  function removeRow(idx: number) { setFormItems((prev) => prev.filter((_, i) => i !== idx)); }
  function onProductSelect(idx: number, code: string) {
    const p = products.find((x) => x.productCode === code);
    updateItem(idx, { productCode: code, cost: p?.capitalPrice || 0 });
  }

  const totalPreview = formItems.reduce((acc, it) => acc + (it.qty * it.cost), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = formItems.filter((it) => it.productCode && it.qty > 0);
    if (cleaned.length === 0) { setMsg({ type: "error", text: "Minimal 1 item." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/purchase-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: cleaned }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setModalOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  const columns: Column<Retur>[] = [
    { key: "rtrId", label: "Retur ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.rtrId}</span> },
    { key: "rcvId", label: "Rcv Ref", render: (r) => <span className="font-mono text-[11px]">{r.rcvId || "-"}</span> },
    { key: "supplierName", label: "Supplier", render: (r) => <span className="text-[11px]">{r.supplierName || "-"}</span> },
    { key: "returnDate", label: "Tgl", render: (r) => <span className="font-mono text-[10px]">{r.returnDate}</span> },
    { key: "totalAmount", label: "Total", render: (r) => <span className="font-mono text-[11px] font-bold text-rose-700">{fmtRp(r.totalAmount)}</span> },
    { key: "reason", label: "Alasan", render: (r) => <span className="text-[10px]">{r.reason || "-"}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Retur Pembelian</span>
          <p className="text-[11px] text-slate-500">Pengembalian barang ke supplier</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari rtr/rcv/supplier..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Catat Retur</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.rtrId} emptyMessage="Belum ada retur." />

      <WarungModal open={modalOpen} title="Catat Retur Pembelian" onClose={() => setModalOpen(false)} maxWidth="max-w-3xl">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receiving (opsional)</label>
              <select value={form.rcvId} onChange={(e) => setForm({ ...form, rcvId: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">-- tanpa referensi --</option>
                {receivings.map((r) => <option key={r.rcvId} value={r.rcvId}>{r.rcvId} - {r.supplierName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tgl Retur</label>
              <input type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700">Item</label>
              <button type="button" onClick={addRow} className="px-2 py-1 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">+ Baris</button>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {formItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border border-slate-200 rounded-lg p-2">
                  <div className="col-span-6">
                    <select value={it.productCode} onChange={(e) => onProductSelect(idx, e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs">
                      <option value="">-- produk --</option>
                      {products.map((p) => <option key={p.productCode} value={p.productCode}>{p.productCode} - {p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="number" min={1} step={1} value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" placeholder="Qty" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" min={0} step={1} value={it.cost} onChange={(e) => updateItem(idx, { cost: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" placeholder="Harga" />
                  </div>
                  <div className="col-span-1">
                    <button type="button" onClick={() => removeRow(idx)} className="w-full px-2 py-1.5 rounded bg-rose-100 text-rose-800 text-xs font-bold">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-slate-200 pt-2">
            <span className="text-xs text-slate-600">Total: <b className="text-rose-700">{fmtRp(totalPreview)}</b></span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan</label>
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">-- pilih --</option>
                <option value="RUSAK">Rusak</option>
                <option value="EXPIRED">Expired</option>
                <option value="SALAH_KIRIM">Salah Kirim</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg">{submitting ? "Menyimpan..." : "Simpan Retur"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}