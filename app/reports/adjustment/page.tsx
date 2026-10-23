"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { StockAdjustment } from "@/lib/types";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function KonterAdjustmentReportPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await operationalService.getAdjustments();
        setAdjustments(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleExportPdfRow(adj: StockAdjustment) {
    const doc = new jsPDF();
    doc.setFillColor(45, 18, 31);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`WMS Atin's Collection - Bukti Stock Adjustment`, 14, 16);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`No. Dokumen: ${adj.adjustmentNumber} | Waktu: ${new Date(adj.timestamp).toLocaleString("id-ID")}`, 14, 32);

    const bodyData = [
      ["No. Adjustment", adj.adjustmentNumber],
      ["Waktu Koreksi", new Date(adj.timestamp).toLocaleString("id-ID")],
      ["SKU Produk", adj.productSku],
      ["Nama Produk", adj.productName],
      ["Stok Sistem", String(adj.systemStock)],
      ["Stok Fisik Real", String(adj.physicalStock)],
      ["Selisih (Difference)", adj.difference > 0 ? `+${adj.difference}` : String(adj.difference)],
      ["Alasan Koreksi", adj.reason],
      ["Operator", adj.operatorName]
    ];

    (doc as any).autoTable({
      startY: 38,
      head: [["Informasi", "Keterangan"]],
      body: bodyData,
      headStyles: { fillColor: [45, 18, 31], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 5 }
    });

    doc.save(`adjustment_${adj.adjustmentNumber}.pdf`);
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="border-b border-rose-100 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Laporan Stock Adjustment</h1>
        <p className="text-xs text-slate-500">Daftar koreksi penyesuaian stok fisik dengan unduh file PDF per baris dokumen.</p>
      </div>

      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
              <th className="p-3">No. Adjustment</th>
              <th className="p-3">Waktu</th>
              <th className="p-3">SKU / Produk</th>
              <th className="p-3 text-center">Sistem</th>
              <th className="p-3 text-center">Fisik</th>
              <th className="p-3 text-center">Selisih</th>
              <th className="p-3">Alasan</th>
              <th className="p-3 text-center">Unduh PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
            {loading ? (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400">Memuat data adjustment...</td></tr>
            ) : adjustments.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400">Belum ada riwayat stock adjustment.</td></tr>
            ) : (
              adjustments.map(adj => (
                <tr key={adj.id} className="hover:bg-rose-50/20">
                  <td className="p-3 font-mono font-bold text-[#BE185D]">{adj.adjustmentNumber}</td>
                  <td className="p-3 font-mono">{new Date(adj.timestamp).toLocaleString("id-ID")}</td>
                  <td className="p-3"><span className="font-mono font-bold">{adj.productSku}</span> - {adj.productName}</td>
                  <td className="p-3 text-center font-mono">{adj.systemStock}</td>
                  <td className="p-3 text-center font-mono">{adj.physicalStock}</td>
                  <td className={`p-3 text-center font-mono font-bold ${adj.difference < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {adj.difference > 0 ? `+${adj.difference}` : adj.difference}
                  </td>
                  <td className="p-3 text-slate-600">{adj.reason}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleExportPdfRow(adj)} className="px-2.5 py-1 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded shadow-xs">
                      PDF File
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}