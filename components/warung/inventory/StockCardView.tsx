"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Movement {
  docId: string;
  productCode: string;
  type: string;
  qty: number;
  balanceBefore: number;
  balanceAfter: number;
  refType: string;
  refId: string;
  cost: number;
  notes: string;
  actorName: string;
  createdAt: string;
}

interface Product {
  productCode: string;
  name: string;
}

export default function StockCardView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadProducts() {
    try {
      const r = await fetch("/api/warung/products");
      const j = await r.json();
      if (j.success) setProducts(j.data);
    } catch {}
  }

  async function loadMovements() {
    if (!selected) { setMovements([]); return; }
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/warung/stocks/${encodeURIComponent(selected)}/movements`);
      const j = await r.json();
      if (j.success) setMovements(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { loadMovements(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selected]);

  const filteredProducts = products.filter((p) => !q || p.productCode.toLowerCase().includes(q.toLowerCase()) || p.name.toLowerCase().includes(q.toLowerCase()));

  const columns: Column<Movement>[] = [
    { key: "createdAt", label: "Tanggal", render: (r) => <span className="text-[10px] font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"}</span> },
    { key: "type", label: "Tipe", render: (r) => <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">{r.type}</span> },
    { key: "qty", label: "Qty", render: (r) => <span className={`font-mono font-bold ${r.qty > 0 ? "text-emerald-700" : "text-rose-700"}`}>{r.qty > 0 ? "+" : ""}{r.qty}</span> },
    { key: "balanceAfter", label: "Saldo", render: (r) => <span className="font-mono">{r.balanceAfter}</span> },
    { key: "refType", label: "Ref", render: (r) => <span className="text-[10px]">{r.refType}{r.refId ? " - " + r.refId : ""}</span> },
    { key: "notes", label: "Catatan", render: (r) => <span className="text-[10px]">{r.notes || "-"}</span> },
    { key: "actorName", label: "Oleh", render: (r) => <span className="text-[10px]">{r.actorName || "-"}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div>
        <span className="text-xs font-bold text-slate-900 uppercase">Kartu Stok</span>
        <p className="text-[11px] text-slate-500">Riwayat mutasi stok per produk</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <WarungSearchInput value={q} onChange={setQ} placeholder="Cari produk..." />
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs min-w-[260px]">
          <option value="">-- pilih produk --</option>
          {filteredProducts.map((p) => <option key={p.productCode} value={p.productCode}>{p.productCode} - {p.name}</option>)}
        </select>
        <button type="button" onClick={loadMovements} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Refresh</button>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      {selected ? (
        <WarungDataTable columns={columns} data={movements} loading={loading} rowKey={(r) => r.docId} emptyMessage="Belum ada mutasi untuk produk ini." />
      ) : (
        <div className="p-6 text-center text-slate-400 text-xs">Pilih produk terlebih dahulu.</div>
      )}
    </div>
  );
}