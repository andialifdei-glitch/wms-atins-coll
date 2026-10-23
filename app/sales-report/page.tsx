"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProduct } from "@/lib/types";
import * as XLSX from "xlsx";

export default function KonterSalesReportPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Kosongkan default filter agar langsung memuat semua riwayat transaksi
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  async function loadData() {
    setLoading(true);
    try {
      const [rawSales, prodList] = await Promise.all([
        operationalService.getSales(startDate || undefined, endDate || undefined),
        operationalService.getProducts()
      ]);

      setProducts(prodList);

      const enrichedSales = rawSales.map((s: any, idx: number) => {
        const itemName = s.itemName || s.productName || s.name || "-";
        
        const matchedProduct = prodList.find((p: any) => 
          p.name.trim().toLowerCase() === itemName.trim().toLowerCase() ||
          p.sku.toLowerCase() === (s.sku || "").toLowerCase()
        );

        // Ekstraksi tanggal aman
        let dateStr = "-";
        if (s.date) {
          if (typeof s.date.toDate === "function") {
            dateStr = s.date.toDate().toISOString().slice(0, 10);
          } else if (s.date instanceof Date) {
            dateStr = s.date.toISOString().slice(0, 10);
          } else if (typeof s.date === "string") {
            dateStr = s.date.slice(0, 10);
          }
        }

        const qty = Number(s.qty ?? s.quantity ?? 1);
        const sellingPrice = Number(s.price ?? matchedProduct?.sellingPrice ?? 0);
        const totalOmzet = Number(s.total ?? s.totalOmzet ?? (qty * sellingPrice));
        const capitalPrice = Number(s.capitalPrice ?? matchedProduct?.capitalPrice ?? 0);
        const grossProfit = Number(s.grossProfit ?? (totalOmzet - (capitalPrice * qty)));

        return {
          id: s.id || `row-${idx}`,
          transactionId: s.transactionId || s.noTrx || "-",
          date: dateStr,
          sku: s.sku || matchedProduct?.sku || "-",
          itemName: itemName,
          category: s.category || matchedProduct?.productCategory || matchedProduct?.stockCategory || "Umum",
          qty: qty,
          totalOmzet: totalOmzet,
          grossProfit: grossProfit,
          user: s.user || s.operator || "-"
        };
      });

      setSales(enrichedSales);
    } catch (err: any) {
      console.error("Gagal memuat laporan penjualan:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearDate() {
    const targetDate = startDate || prompt("Masukkan tanggal yang ingin dihapus (YYYY-MM-DD):");
    if (!targetDate) return;
    if (!confirm(`Hapus semua transaksi tanggal ${targetDate}?`)) return;

    try {
      const count = await operationalService.clearSalesByDate(targetDate);
      alert(`Berhasil menghapus ${count} transaksi pada tanggal ${targetDate}.`);
      loadData();
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    }
  }

  function handleExportExcel() {
    if (sales.length === 0) {
      alert("Tidak ada data penjualan untuk diekspor.");
      return;
    }

    const exportRows = sales.map((s, idx) => ({
      "No": idx + 1,
      "No. Trx": s.transactionId,
      "Tanggal": s.date,
      "SKU": s.sku,
      "Nama Produk": s.itemName,
      "Kategori": s.category,
      "Qty": s.qty,
      "Omzet (Rp)": s.totalOmzet,
      "Laba Kotor (Rp)": s.grossProfit,
      "Kasir / User": s.user
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
    XLSX.writeFile(wb, `Laporan_Penjualan.xlsx`);
  }

  const totalOmzetAll = sales.reduce((acc, curr) => acc + (curr.totalOmzet || 0), 0);
  const totalProfitAll = sales.reduce((acc, curr) => acc + (curr.grossProfit || 0), 0);
  const totalQtyAll = sales.reduce((acc, curr) => acc + (curr.qty || 0), 0);

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Laporan Penjualan</h1>
          <p className="text-xs text-slate-500">Rekapitulasi omzet dan laba kotor transaksi penjualan.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearDate}
            className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition text-[11px]"
          >
            Hapus Data Tanggal
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-lg shadow-sm transition"
          >
            Ekspor ke Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex items-center gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-1.5 border rounded font-mono bg-slate-50 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-1.5 border rounded font-mono bg-slate-50 text-slate-800"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="mt-4 px-2 py-1 text-slate-500 hover:text-rose-600 font-bold underline text-[10px]"
            >
              Reset
            </button>
          )}
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
          <span className="block text-slate-500 font-bold">Total Transaksi</span>
          <span className="text-lg font-bold font-mono text-slate-900">{sales.length} Trx ({totalQtyAll} Qty)</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
          <span className="block text-slate-500 font-bold">Total Omzet</span>
          <span className="text-lg font-bold font-mono text-slate-900">Rp {totalOmzetAll.toLocaleString("id-ID")}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm">
          <span className="block text-slate-500 font-bold">Total Laba Kotor</span>
          <span className="text-lg font-bold font-mono text-emerald-600">Rp {totalProfitAll.toLocaleString("id-ID")}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">No. Trx</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Nama Produk</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Omzet</th>
                <th className="p-3 text-right">Laba Kotor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Memuat data laporan penjualan...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Tidak ada data transaksi.</td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-slate-700">{s.transactionId}</td>
                    <td className="p-3 font-mono text-slate-600">{s.date}</td>
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{s.sku}</td>
                    <td className="p-3 font-bold">{s.itemName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {s.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">{s.qty}</td>
                    <td className="p-3 text-right font-mono font-bold">Rp {s.totalOmzet.toLocaleString("id-ID")}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">Rp {s.grossProfit.toLocaleString("id-ID")}</td>
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