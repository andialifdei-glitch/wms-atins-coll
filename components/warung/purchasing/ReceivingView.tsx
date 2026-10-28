"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface RcvItem {
  productCode: string;
  productName: string;
  qtyOrdered: number;
  qtyReceived: number;
  cost: number;
  subtotal: number;
}

interface Rcv {
  rcvId: string;
  poId: string;
  supplierCode: string;
  supplierName: string;
  receiveDate: string;
  status: string;
  items: RcvItem[];
  totalAmount: number;
  notes: string;
  createdAt: string;
  createdBy: string;
}

interface Po {
  poId: string;
  supplierCode: string;
  supplierName: string;
  status: string;
  items: Array<{ productCode: string; productName: string; qty: number; cost: number; subtotal: number }>;
}

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function ReceivingView() {
  const [items, setItems] = useState<Rcv[]>([]);
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ poId: "", receiveDate: new Date().toISOString().slice(0, 10), notes: "" });
  const [formItems, setFormItems] = useState<Array<{ productCode: string; productName: string; qtyOrdered: number; qtyReceived: number; cost: number }>>([]);
  const [submitting, setSubmitting] = useState(false);

  async function loadPos() {
    try {
      const r = await fetch("/api/warung/po?status=ORDERED");
      const j = await r.json();
      if (j.success) setPos(j.data);
    } catch {}
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch("/api/warung/receiving?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadPos(); load(); }, []);

  function openCreate() {
    setForm({ poId: "", receiveDate: new Date().toISOString().slice(0, 10), notes: "" });
    setFormItems([]);
    setModalOpen(true);
  }

  function onSelectPo(poId: string) {
    setForm({ ...form, poId });
    const po = pos.find((p) => p.poId === poId);
    if (po) {
      setFormItems(po.items.map((it) => ({ productCode: it.productCode, productName: it.productName, qtyOrdered: it.qty, qtyReceived: it.qty, cost: it.cost })));
    } else {
      setFormItems([]);
    }
  }

  function updateItem(idx: number, patch: Partial<{ qtyReceived: number; cost: number }>) {
    setFormItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  const totalPreview = formItems.reduce((acc, it) => acc + (it.qtyReceived * it.cost), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.poId) { setMsg({ type: "error", text: "PO wajib dipilih." }); return; }
    const cleaned = formItems.filter((it) => it.productCode && it.qtyReceived > 0);
    if (cleaned.length === 0) { setMsg({ type: "error", text: "Minimal 1 item." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: cleaned }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setModalOpen(false);
      await loadPos();
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  const columns: Column<Rcv>[] = [
    { key: "rcvId", label: "Rcv ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.rcvId}</span> },
    { key: "poId", label: "PO Ref", render: (r) => <span className="font-mono text-[11px]">{r.poId}</span> },
    { key: "supplierName", label: "Supplier", render: (r) => <span className="text-[11px]">{r.supplierName}</span> },
    { key: "receiveDate", label: "Tgl", render: (r) => <span className="font-mono text-[10px]">{r.receiveDate}</span> },
    { key: "totalAmount", label: "Total", render: (r) => <span className="font-mono text-[11px] font-bold text-emerald-700">{fmtRp(r.totalAmount)}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Receiving</span>
          <p className="text-[11px] text-slate-500">Penerimaan barang dari PO</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari rcv/po/supplier..." />
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Terima Barang</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.rcvId} emptyMessage="Belum ada receiving." />

      <WarungModal open={modalOpen} title="Terima Barang (Receiving)" onClose={() => setModalOpen(false)} maxWidth="max-w-3xl">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PO (ORDERED saja)</label>
              <select required value={form.poId} onChange={(e) => onSelectPo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">-- pilih PO --</option>
                {pos.map((p) => <option key={p.poId} value={p.poId}>{p.poId} - {p.supplierName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tgl Terima</label>
              <input type="date" value={form.receiveDate} onChange={(e) => setForm({ ...form, receiveDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {formItems.length > 0 && (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              <div className="text-[10px] uppercase font-bold text-slate-500">Item PO (qty receive dapat lebih/kurang)</div>
              {formItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border border-slate-200 rounded-lg p-2">
                  <div className="col-span-5 text-xs">
                    <b>{it.productName}</b>
                    <div className="text-[10px] text-slate-500">{it.productCode}</div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500">Order</label>
                    <input type="number" disabled value={it.qtyOrdered} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-slate-50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500">Terima</label>
                    <input type="number" min={1} step={1} value={it.qtyReceived} onChange={(e) => updateItem(idx, { qtyReceived: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-500">Harga</label>
                    <input type="number" min={0} step={1} value={it.cost} onChange={(e) => updateItem(idx, { cost: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {formItems.length > 0 && (
            <div className="text-right text-xs border-t border-slate-200 pt-2">
              Total: <b className="text-emerald-700">{fmtRp(totalPreview)}</b>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting || formItems.length === 0} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50">{submitting ? "Menyimpan..." : "Posting Receiving"}</button>
          </div>
          <p className="text-[10px] text-slate-500 italic">Setelah posting, stok otomatis bertambah dan PO ditandai RECEIVED.</p>
        </form>
      </WarungModal>
    </div>
  );
}