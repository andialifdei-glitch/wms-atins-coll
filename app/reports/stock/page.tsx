"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProduct } from "@/lib/types";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function KonterStockReportPage() {
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await operationalService.getProducts();
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleExportExcel() {
    let csvContent = "data:text/csv;charset=utf-8,SKU,Nama Produk,Kategori Stock,Kategori Barang,Satuan,Modal,Harga Jual,Stok Saat Ini\n";
    products.forEach(p => {
      csvContent += `"${p.sku}","${p.name}","${p.stockCategory}","${p.productCategory}","${p.unit}",${p.capitalPrice},${p.sellingPrice},${p.currentStock}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_stock_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportPdf() {
    const doc = new jsPDF();
    
    // Header Tema WMS Burgundy (#2D121F)
    doc.setFillColor(45, 18, 31);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("WMS Atin's Collection - Laporan Stock Produk", 14, 16);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString("id-ID")}`, 14, 32);

    const tableData = products.map(p => [
      p.sku,
      p.name,
      p.stockCategory,
      `Rp ${p.capitalPrice.toLocaleString("id-ID")}`,
      `Rp ${p.sellingPrice.toLocaleString("id-ID")}`,
      `${p.currentStock} ${p.unit}`
    ]);

    (doc as any).autoTable({
      startY: 38,
      head: [["SKU", "Nama Produk", "Kategori", "Modal", "Harga Jual", "Stok"]],
      body: tableData,
      headStyles: { fillColor: [45, 18, 31], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
      alternateRowStyles: { fillColor: [253, 248, 249] }
    });

    doc.save(`laporan_stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Laporan Stock Produk</h1>
          <p className="text-xs text-slate-500">Rekapitulasi master stok fisik dan jasa beserta valuasi modal dan harga jual.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm">
            Ekspor ke Excel (CSV)
          </button>
          <button onClick={handleExportPdf} className="px-3.5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm">
            Ekspor ke PDF File
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
              <th className="p-3">SKU</th>
              <th className="p-3">Nama Produk</th>
              <th className="p-3">Kategori Stock</th>
              <th className="p-3 text-right">Modal</th>
              <th className="p-3 text-right">Harga Jual</th>
              <th className="p-3 text-center">Stok Saat Ini</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Memuat data stock...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Tidak ada produk terdaftar.</td></tr>
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
                  <td className="p-3 text-right font-mono">Rp {p.capitalPrice.toLocaleString("id-ID")}</td>
                  <td className="p-3 text-right font-mono font-bold">Rp {p.sellingPrice.toLocaleString("id-ID")}</td>
                  <td className="p-3 text-center font-mono font-bold">{p.currentStock} {p.unit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}