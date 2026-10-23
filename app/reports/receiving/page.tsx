"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { ReceivingDocument } from "@/lib/types";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function KonterReceivingReportPage() {
  const [receivings, setReceivings] = useState<ReceivingDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await operationalService.getReceivings();
        setReceivings(data as any);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleExportPdfRow(rcv: ReceivingDocument) {
    const doc = new jsPDF();
    doc.setFillColor(45, 18, 31);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("WMS Atin's Collection - Dokumen Penerimaan Barang", 14, 16);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`No. Receiving: ${rcv.rcvNumber} | PO: ${rcv.poNumber} | Supplier: ${rcv.supplierName}`, 14, 32);

    const tableData = rcv.items.map(i => [
      i.sku,
      i.name,
      String(i.receivedQty),
      `Rp ${i.capitalPrice.toLocaleString("id-ID")}`
    ]);

    (doc as any).autoTable({
      startY: 38,
      head: [["SKU", "Nama Barang", "Qty Diterima", "Modal Satuan"]],
      body: tableData,
      headStyles: { fillColor: [45, 18, 31], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setTextColor(45, 18, 31);
    doc.text(`Operator: ${rcv.operatorName}`, 14, finalY);
    doc.text(`Catatan: ${rcv.notes || "-"}`, 14, finalY + 6);

    doc.save(`receiving_${rcv.rcvNumber}.pdf`);
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="border-b border-rose-100 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Laporan Receiving</h1>
        <p className="text-xs text-slate-500">Daftar dokumen penerimaan barang dengan unduh file PDF per baris dokumen.</p>
      </div>

      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
              <th className="p-3">No. Receiving</th>
              <th className="p-3">No. PO</th>
              <th className="p-3">Supplier</th>
              <th className="p-3">Tanggal Terima</th>
              <th className="p-3">Operator</th>
              <th className="p-3 text-center">Unduh PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Memuat laporan receiving...</td></tr>
            ) : receivings.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Belum ada data receiving.</td></tr>
            ) : (
              receivings.map(rcv => (
                <tr key={rcv.id} className="hover:bg-rose-50/20">
                  <td className="p-3 font-mono font-bold text-[#BE185D]">{rcv.rcvNumber}</td>
                  <td className="p-3 font-mono">{rcv.poNumber}</td>
                  <td className="p-3 font-bold">{rcv.supplierName}</td>
                  <td className="p-3 font-mono">{new Date(rcv.receivedDate).toLocaleString("id-ID")}</td>
                  <td className="p-3">{rcv.operatorName}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleExportPdfRow(rcv)} className="px-2.5 py-1 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded shadow-xs">
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