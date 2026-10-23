"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { PurchaseOrder, ReceivingDocument } from "@/lib/types";

export default function KonterReceivingPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receivings, setReceivings] = useState<ReceivingDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // State Form Receiving
  const [selectedPoId, setSelectedPoId] = useState("");
  const [receivingItems, setReceivingItems] = useState<{ sku: string; name: string; maxQty: number; receivedQty: number; capitalPrice: number }[]>([]);
  const [operatorName, setOperatorName] = useState("Admin Konter");
  const [notes, setNotes] = useState("");

  // Modal Alert / Confirm WMS Theme
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string }>({ show: false, title: "", message: "" });
  const [confirmModal, setConfirmModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pos, rcvs] = await Promise.all([
        operationalService.getPurchaseOrders(),
        operationalService.getReceivings()
      ]);
      setPurchaseOrders(pos.filter(p => p.status === "OPEN" || p.status === "PARTIALLY_RECEIVED") as any);
      setReceivings(rcvs as any);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data penerimaan: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleSelectPo(poId: string) {
    setSelectedPoId(poId);
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) {
      setReceivingItems([]);
      return;
    }

    const items = po.items.map(i => ({
      sku: i.sku,
      name: i.name,
      maxQty: i.quantity - i.receivedQuantity,
      receivedQty: i.quantity - i.receivedQuantity,
      capitalPrice: i.capitalPrice
    }));
    setReceivingItems(items);
  }

  function handleQtyChange(sku: string, qty: number) {
    const item = receivingItems.find(i => i.sku === sku);
    if (!item) return;

    // Rules: Jika melebihi sisa PO, tolak input dan beri alert bertema WMS
    if (qty > item.maxQty) {
      setAlertModal({
        show: true,
        title: "Kuantitas Fisik Melebihi PO",
        message: `Kuantitas fisik yang diinput (${qty}) untuk barang [${item.name}] melebihi sisa pesanan PO (${item.maxQty}). Maksimal input adalah ${item.maxQty}.`
      });
      return;
    }

    setReceivingItems(receivingItems.map(i => {
      if (i.sku === sku) {
        const validQty = Math.max(0, qty);
        return { ...i, receivedQty: validQty };
      }
      return i;
    }));
  }

  function handlePreSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPoId) {
      setMsg({ type: "error", text: "Pilih Purchase Order terlebih dahulu." });
      return;
    }

    const totalReceive = receivingItems.reduce((acc, curr) => acc + curr.receivedQty, 0);
    if (totalReceive <= 0) {
      setMsg({ type: "error", text: "Kuantitas barang yang diterima minimal 1." });
      return;
    }

    // Munculkan modal konfirmasi bertema WMS sebelum eksekusi OK
    setConfirmModal(true);
  }

  async function executeConfirmedReceiving() {
    setConfirmModal(false);
    setSubmitting(true);
    setMsg(null);
    try {
      await operationalService.executeReceiving({
        poId: selectedPoId,
        items: receivingItems.map(i => ({ sku: i.sku, name: i.name, receivedQty: i.receivedQty, capitalPrice: i.capitalPrice })),
        operatorName,
        notes
      });
      setMsg({ type: "success", text: "Penerimaan barang berhasil dikonfirmasi. Stok produk dan status PO telah diperbarui." });
      setSelectedPoId("");
      setReceivingItems([]);
      setNotes("");
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPoObj = purchaseOrders.find(p => p.id === selectedPoId);

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="border-b border-rose-100 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Penerimaan Barang (Receiving)</h1>
        <p className="text-xs text-slate-500">Terima barang fisik/voucher dari Purchase Order dan update otomatis saldo stock.</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Form Eksekusi Penerimaan */}
      <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Form Terima Barang dari PO</h2>
        <form onSubmit={handlePreSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-900 font-semibold mb-1">Pilih Dokumen PO (Open / Partially Received) <span className="text-rose-600">*</span></label>
            <select
              value={selectedPoId}
              onChange={(e) => handleSelectPo(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium"
            >
              <option value="">-- Pilih Purchase Order --</option>
              {purchaseOrders.map(po => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} - {po.supplierName} (Total: Rp {po.totalAmount.toLocaleString("id-ID")})
                </option>
              ))}
            </select>
          </div>

          {selectedPoObj && (
            <div className="space-y-2 border-t border-rose-100 pt-3">
              <span className="font-bold text-slate-800 block">Daftar Item PO &amp; Input Sesuai Fisik (Boleh Kurang dari PO, Tidak Boleh Lebih):</span>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b text-[11px] font-bold text-slate-700">
                      <th className="p-2">SKU</th>
                      <th className="p-2">Nama Barang</th>
                      <th className="p-2 text-center">Sisa PO</th>
                      <th className="p-2 text-center w-32">Terima Qty Fisik</th>
                      <th className="p-2 text-right">Modal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {receivingItems.map((item, index) => (
                      <tr key={`${item.sku}-${index}`}>
                        <td className="p-2 font-mono font-bold text-[#BE185D]">{item.sku}</td>
                        <td className="p-2 font-semibold text-slate-900">{item.name}</td>
                        <td className="p-2 text-center font-bold text-slate-700">{item.maxQty}</td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={item.maxQty}
                            value={item.receivedQty}
                            onChange={(e) => handleQtyChange(item.sku, Number(e.target.value))}
                            className="w-24 p-1 border rounded font-mono text-center font-bold"
                          />
                        </td>
                        <td className="p-2 text-right font-mono">Rp {item.capitalPrice.toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-900 font-semibold mb-1">Nama Operator</label>
              <input
                type="text"
                required
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-900 font-semibold mb-1">Catatan Penerimaan</label>
              <input
                type="text"
                placeholder="Catatan opsional..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || !selectedPoId}
              className="px-4 py-2 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm transition"
            >
              {submitting ? "Memproses..." : "Konfirmasi Penerimaan Barang"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Alert WMS */}
      {alertModal.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-[#2D121F] w-full max-w-sm p-5 text-slate-900 space-y-3">
            <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
              <div className="w-3 h-3 rounded-full bg-[#BE185D]"></div>
              <h3 className="text-sm font-bold text-[#2D121F]">{alertModal.title}</h3>
            </div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">{alertModal.message}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAlertModal({ show: false, title: "", message: "" })}
                className="px-4 py-1.5 bg-[#2D121F] hover:bg-[#BE185D] text-white font-bold rounded-lg shadow-sm transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi WMS */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-[#2D121F] w-full max-w-md p-5 text-slate-900 space-y-3">
            <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
              <div className="w-3 h-3 rounded-full bg-[#BE185D]"></div>
              <h3 className="text-sm font-bold text-[#2D121F]">Konfirmasi Penerimaan Barang</h3>
            </div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Apakah Anda yakin ingin menyimpan dan mengonfirmasi penerimaan barang fisik ini? Stok produk akan diperbarui secara otomatis.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Batal
              </button>
              <button
                onClick={executeConfirmedReceiving}
                className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm transition"
              >
                Ya, Konfirmasi OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat Dokumen Receiving */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-rose-100 font-bold text-slate-900">Riwayat Dokumen Penerimaan Barang</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">No. Receiving</th>
                <th className="p-3">No. PO</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Tanggal Terima</th>
                <th className="p-3">Operator</th>
                <th className="p-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Memuat riwayat receiving...</td>
                </tr>
              ) : receivings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Belum ada riwayat penerimaan barang.</td>
                </tr>
              ) : (
                receivings.map((rcv) => (
                  <tr key={rcv.id} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{rcv.rcvNumber}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{rcv.poNumber}</td>
                    <td className="p-3 font-semibold text-slate-900">{rcv.supplierName}</td>
                    <td className="p-3 font-mono">{rcv.receivedDate ? new Date(rcv.receivedDate).toLocaleString("id-ID") : "-"}</td>
                    <td className="p-3">{rcv.operatorName}</td>
                    <td className="p-3 text-slate-600">{rcv.notes || "-"}</td>
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