"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProduct, StockMovement } from "@/lib/types";

export default function KonterStockCardReportPage() {
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Detail Kartu Stock per Produk
  const [selectedProduct, setSelectedProduct] = useState<KonterProduct | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [prods, movs] = await Promise.all([
          operationalService.getProducts(),
          operationalService.getMovements(500)
        ]);
        setProducts(prods);
        setMovements(movs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="border-b border-rose-100 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Kartu Stock (Stock Card)</h1>
        <p className="text-xs text-slate-500">Monitor mutasi dan riwayat pergerakan stok secara detail untuk masing-masing produk.</p>
      </div>

      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
              <th className="p-3">SKU</th>
              <th className="p-3">Nama Produk</th>
              <th className="p-3">Kategori Stock</th>
              <th className="p-3 text-center">Stok Saat Ini</th>
              <th className="p-3 text-center">Aksi Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">Memuat produk...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">Tidak ada produk terdaftar.</td></tr>
            ) : (
              products.map(p => (
                <tr key={p.id} className="hover:bg-rose-50/20">
                  <td className="p-3 font-mono font-bold text-[#BE185D]">{p.sku}</td>
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.stockCategory === "FISIK" ? "bg-amber-100 text-amber-900" : "bg-purple-100 text-purple-900"}`}>
                      {p.stockCategory}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-900">{p.currentStock} {p.unit}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedProduct(p)}
                      className="px-3 py-1 bg-[#2D121F] hover:bg-[#BE185D] text-white font-bold rounded-lg shadow-xs transition"
                    >
                      Lihat Kartu Stock
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Detail Kartu Stock per Produk */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-[#2D121F] w-full max-w-4xl p-6 text-slate-900 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-rose-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-[#2D121F]">Kartu Stock Detail: {selectedProduct.name}</h2>
                <p className="text-xs text-slate-500 font-mono">SKU: {selectedProduct.sku} | Kategori: {selectedProduct.stockCategory}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold"
              >
                Tutup X
              </button>
            </div>

            <div className="bg-rose-50/60 p-3 rounded-lg border border-rose-200 flex justify-between items-center">
              <span className="font-semibold text-rose-900">Saldo Stok Terkini dalam Sistem:</span>
              <span className="font-mono font-bold text-base text-[#BE185D]">{selectedProduct.currentStock} {selectedProduct.unit}</span>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700">
                    <th className="p-2.5">Waktu</th>
                    <th className="p-2.5">Tipe Mutasi</th>
                    <th className="p-2.5 text-center">Sebelum</th>
                    <th className="p-2.5 text-center">Perubahan</th>
                    <th className="p-2.5 text-center">Sesudah</th>
                    <th className="p-2.5">Referensi / Dokumen</th>
                    <th className="p-2.5">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.filter(m => m.productSku === selectedProduct.sku).length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">Belum ada riwayat mutasi untuk produk ini.</td></tr>
                  ) : (
                    movements.filter(m => m.productSku === selectedProduct.sku).map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono">{new Date(m.timestamp).toLocaleString("id-ID")}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.type === "STOCK_MASUK" || m.type === "RECEIVING" ? "bg-emerald-100 text-emerald-900" :
                            m.type === "STOCK_KELUAR" ? "bg-rose-100 text-rose-900" : "bg-purple-100 text-purple-900"
                          }`}>
                            {m.type}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono">{m.quantityBefore}</td>
                        <td className={`p-2.5 text-center font-mono font-bold ${m.quantityChange < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">{m.quantityAfter}</td>
                        <td className="p-2.5 font-mono text-slate-700">{m.referenceDoc}</td>
                        <td className="p-2.5 text-slate-600">{m.operatorName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}