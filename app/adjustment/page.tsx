"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProduct, StockAdjustment } from "@/lib/types";

export default function StockAdjustmentPage() {
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [physicalStock, setPhysicalStock] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    initData();
  }, []);

  async function initData() {
    setLoading(true);
    try {
      const [prods, adjs] = await Promise.all([
        operationalService.getProducts(),
        operationalService.getAdjustments()
      ]);
      setProducts(prods);
      setAdjustments(adjs);
      if (prods.length > 0) {
        setSelectedProductId(prods[0].id || "");
        setPhysicalStock(prods[0].currentStock);
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const systemStock = selectedProduct ? selectedProduct.currentStock : 0;
  const diff = physicalStock - systemStock;

  async function handleApplyAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setMsg({ type: "error", text: "Alasan penyesuaian wajib diisi." });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    try {
      await operationalService.executeStockAdjustment({
        productId: selectedProductId,
        physicalStock,
        reason,
        operatorName: "Admin Konter"
      });
      setMsg({ type: "success", text: "Stok berhasil disesuaikan dan dicatat ke Firestore!" });
      setReason("");
      await initData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-xl font-bold text-slate-800">Stock Adjustment</h1>
        <p className="text-xs text-slate-500">Koreksi fisik stok sistem secara atomik dengan audit trail lengkap.</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-xs ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm max-w-xl text-xs space-y-4">
        <h2 className="font-bold text-slate-800">Form Koreksi Stok Fisik</h2>
        <form onSubmit={handleApplyAdjustment} className="space-y-3">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Pilih Produk</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = products.find(prod => prod.id === e.target.value);
                if (p) setPhysicalStock(p.currentStock);
              }}
              className="w-full p-2 border rounded-lg outline-none font-semibold"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.sku} - {p.name} (Stok Saat Ini: {p.currentStock} {p.unit})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-400 block text-[10px]">Stok Sistem</span>
              <span className="text-sm font-bold text-slate-700">{systemStock}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Stok Fisik Dihitung</span>
              <input
                type="number"
                min="0"
                value={physicalStock}
                onChange={(e) => setPhysicalStock(Number(e.target.value))}
                className="w-full p-1 border rounded font-bold text-sm bg-white"
              />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Selisih Otomatis</span>
              <span className={`text-sm font-bold ${diff < 0 ? "text-rose-600" : diff > 0 ? "text-emerald-600" : "text-slate-700"}`}>
                {diff > 0 ? `+${diff}` : diff}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Alasan Penyesuaian (Wajib Diisi)</label>
            <textarea
              required
              rows={2}
              placeholder="Contoh: Stok rusak saat penyimpanan atau selisih fisik toko"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border rounded-lg outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || diff === 0}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm"
          >
            {submitting ? "Memproses Koreksi..." : "Terapkan & Simpan Adjustment"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">Riwayat Penyesuaian Stok</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-500 font-semibold">
                <th className="p-3">No. Dokumen</th>
                <th className="p-3">Waktu</th>
                <th className="p-3">SKU &amp; Produk</th>
                <th className="p-3 text-center">Sistem</th>
                <th className="p-3 text-center">Fisik</th>
                <th className="p-3 text-center">Selisih</th>
                <th className="p-3">Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">Belum ada riwayat adjustment.</td>
                </tr>
              ) : (
                adjustments.map((a) => (
                  <tr key={a.id}>
                    <td className="p-3 font-mono font-bold text-indigo-600">{a.adjustmentNumber}</td>
                    <td className="p-3 text-slate-500">{new Date(a.timestamp).toLocaleString("id-ID")}</td>
                    <td className="p-3"><b>{a.productSku}</b> - {a.productName}</td>
                    <td className="p-3 text-center">{a.systemStock}</td>
                    <td className="p-3 text-center font-bold">{a.physicalStock}</td>
                    <td className={`p-3 text-center font-bold ${a.difference < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {a.difference > 0 ? `+${a.difference}` : a.difference}
                    </td>
                    <td className="p-3 text-slate-600">{a.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}