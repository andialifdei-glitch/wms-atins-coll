"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";

export default function PurchasePage() {
  const [poList, setPoList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await operationalService.getPurchaseOrders();
      setPoList(data || []);
    } catch (err: any) {
      setAlertInfo({ title: "Gagal", message: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelPO(poId: string, currentNo: string) {
    const reason = prompt(`Masukkan alasan pembatalan untuk PO ${currentNo}:`);
    if (reason === null) return;
    try {
      await operationalService.cancelPurchaseOrder(poId, reason || "Dibatalkan operator");
      setAlertInfo({ title: "Berhasil", message: `PO ${currentNo} berhasil dibatalkan.`, type: "success" });
      loadData();
    } catch (err: any) {
      setAlertInfo({ title: "Gagal", message: err.message, type: "error" });
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-xs text-slate-800">
      {/* Kustom Alert bertema sistem */}
      {alertInfo && (
        <div className={`p-4 rounded-xl border flex justify-between items-center shadow-xs ${
          alertInfo.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-900" :
          alertInfo.type === "error" ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-sky-50 border-sky-200 text-sky-900"
        }`}>
          <div>
            <h4 className="font-bold text-sm">{alertInfo.title}</h4>
            <p>{alertInfo.message}</p>
          </div>
          <button onClick={() => setAlertInfo(null)} className="font-bold px-3 py-1 rounded-lg bg-white/60 hover:bg-white">Tutup</button>
        </div>
      )}

      <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-xs flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Purchase Order (PO)</h1>
          <p className="text-slate-500 mt-0.5">Kelola pesanan pembelian barang ke supplier dan pembatalan PO.</p>
        </div>
        <button onClick={() => {
          const supName = prompt("Masukkan Nama Supplier:");
          if (!supName) return;
          const totalStr = prompt("Masukkan Total Nominal PO (Rp):", "0");
          const totalAmount = parseFloat(totalStr) || 0;
          operationalService.createPurchaseOrder({
            supplierName: supName,
            totalAmount: totalAmount,
            status: "PENDING"
          }).then(() => {
            setAlertInfo({ title: "Berhasil", message: "Purchase Order baru berhasil dibuat.", type: "success" });
            loadData();
          }).catch((err) => {
            setAlertInfo({ title: "Gagal", message: err.message, type: "error" });
          });
        }} className="px-3.5 py-1.5 bg-[#BE185D] text-white font-bold rounded-lg shadow-xs hover:bg-[#9D174D]">+ Buat PO Baru</button>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b font-semibold text-slate-600">
            <tr>
              <th className="p-3">No. PO</th>
              <th className="p-3">Supplier</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Total (Rp)</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {poList.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">Belum ada Purchase Order.</td></tr>
            ) : (
              poList.map((po) => (
                <tr key={po.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-[#BE185D]">{po.orderNumber || po.poNumber || "-"}</td>
                  <td className="p-3 font-semibold">{po.supplierName || po.supplier || "-"}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      po.status === "CANCELLED" ? "bg-rose-100 text-rose-700" :
                      po.status === "RECEIVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {po.status || "PENDING"}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold">Rp {(Number(po.totalAmount || po.total || 0)).toLocaleString("id-ID")}</td>
                  <td className="p-3 text-center space-x-2">
                    {po.status !== "CANCELLED" && po.status !== "RECEIVED" && (
                      <button onClick={() => handleCancelPO(po.id, po.orderNumber || po.poNumber)} className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded hover:bg-rose-700">
                        Batalkan PO
                      </button>
                    )}
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