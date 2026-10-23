"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { PurchaseOrder } from "@/lib/types";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function KonterPoReportPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await operationalService.getPurchaseOrders();
        setPurchaseOrders(data as any);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleExportPdfRow(po: PurchaseOrder) {
    const doc = new jsPDF();
    doc.setFillColor(45, 18, 31);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`WMS Atin's Collection - Purchase Order (${po.status})`, 14, 16);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`No. PO: ${po.poNumber} | Supplier: ${po.supplierName} | Tanggal: ${new Date(po.orderDate).toLocaleDateString("id-ID")}`, 14, 32);

    const tableData = po.items.map(i => [
      i.sku,
      i.name,
      String(i.quantity),
      String(i.receivedQuantity),
      `Rp ${i.capitalPrice.toLocaleString("id-ID")}`,
      `Rp ${i.subtotal.toLocaleString("id-ID")}`
    ]);

    (doc as any).autoTable({
      startY: 38,
      head: [["SKU", "Nama Barang", "Dipesan", "Diterima", "Modal", "Subtotal"]],
      body: tableData,
      headStyles: { fillColor: [45, 18, 31], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 3 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(45, 18, 31);
    doc.text(`Total Tagihan: Rp ${po.totalAmount.toLocaleString("id-ID")}`, 14, finalY);
    doc.text(`Catatan: ${po.notes || "-"}`, 14, finalY + 6);

    doc.save(`po_${po.poNumber}.pdf`);
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="border-b border-rose-100 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Laporan PO (Purchase Order)</h1>
        <p className="text-xs text-slate-500">Daftar lengkap PO dengan unduh file PDF per baris.</p>
      </div>

      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
              <th className="p-3">No. PO</th>
              <th className="p-3">Tanggal</th>
              <th className="p-3">Supplier</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Total Nominal</th>
              <th className="p-3 text-center">Unduh PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Memuat laporan PO...</td></tr>
            ) : purchaseOrders.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Belum ada dokumen PO.</td></tr>
            ) : (
              purchaseOrders.map(po => (
                <tr key={po.id} className="hover:bg-rose-50/20">
                  <td className="p-3 font-mono font-bold text-[#BE185D]">{po.poNumber}</td>
                  <td className="p-3 font-mono">{new Date(po.orderDate).toLocaleDateString("id-ID")}</td>
                  <td className="p-3 font-bold">{po.supplierName}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${po.status === "COMPLETED" ? "bg-emerald-100 text-emerald-900" : po.status === "CANCELLED" ? "bg-rose-100 text-rose-900" : "bg-blue-100 text-blue-900"}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold">Rp {po.totalAmount.toLocaleString("id-ID")}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleExportPdfRow(po)} className="px-2.5 py-1 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded shadow-xs">
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