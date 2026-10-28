"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface StockRow {
  productCode: string;
  qty: number;
  lastMovementAt: string;
  productName?: string;
  minStock?: number;
  unit?: string;
  low?: boolean;
}

export default function StocksView() {
  const [items, setItems] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [target, setTarget] = useState<StockRow | null>(null);
  const [adjustType, setAdjustType] = useState<"IN" | "OUT" | "ADJ">("IN");
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (lowOnly) params.set("lowOnly", "true");
      const res = await fetch("/api/warung/stocks?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openAdjust(row: StockRow) {
    setTarget(row);
    setAdjustType("IN");
    setAdjustQty(0);
    setNotes("");
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (adjustQty <= 0 && adjustType !== "ADJ") { setMsg({ type: "error", text: "Qty harus > 0." }); return; }
    if (adjustQty === 0) { setMsg({ type: "error", text: "Qty harus != 0." }); return; }
    const signed = adjustType === "OUT" ? -Math.abs(adjustQty) : (adjustType === "IN" ? Math.abs(adjustQty) : adjustQty);
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/warung/stocks/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCode: target.productCode, type: adjustType, qty: signed, notes }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setModalOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  const columns: Column<StockRow>[] = [
    { key: "productCode", label: "Kode Produk", render: (r) => <span className="font-mono font-bold text-slate-900">{r.productCode}</span> },
    { key: "productName", label: "Nama" },
    { key: "qty", label: "Stok", render: (r) => <span className={`font-mono font-bold ${r.qty < 0 ? "text-rose-700" : (r.low ? "text-amber-700" : "text-emerald-700")}`}>{r.qty} {r.unit || ""}</span> },
    { key: "minStock", label: "Min", render: (r) => <span className="font-mono">{r.minStock ?? 0}</span> },
    { key: "low", label: "Alert", render: (r) => r.qty < 0 ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900">NEGATIF</span> : (r.low ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">LOW</span> : <span className="text-[10px] text-slate-400">-</span>) },
    { key: "actions", label: "Aksi", render: (r) => (
      <button type="button" onClick={() => openAdjust(r)} className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold">Adjust</button>
    )},
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Stok Produk</span>
          <p className="text-[11px] text-slate-500">Saldo stok & penyesuaian manual</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <WarungSearchInput value={q} onChange={setQ} placeholder="Cari kode/nama..." />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="w-4 h-4" /> Low only</label>
          <button type="button" onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.productCode} emptyMessage="Belum ada stok. Buat produk dulu atau adjust manual." />

      <WarungModal open={modalOpen} title={target ? `Adjust Stok ${target.productCode}` : "Adjust"} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs">Stok saat ini: <b>{target?.qty}</b> {target?.unit}</p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe</label>
            <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="IN">IN (tambah)</option>
              <option value="OUT">OUT (kurangi)</option>
              <option value="ADJ">ADJ (sesuaikan langsung)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Qty</label>
            <input type="number" step={1} required value={adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <p className="text-[10px] text-slate-500 mt-1">IN/OUT: qty positif. ADJ: qty bisa negatif (misal -5 untuk kurangi 5).</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
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