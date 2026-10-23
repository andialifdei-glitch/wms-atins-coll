"use client";

import React, { useState, useEffect } from "react";
import { operationalService, supplierOperationalService } from "@/lib/operationalService";
import type { PurchaseOrder, KonterSupplier, KonterProduct, KonterProductFamily } from "@/lib/types";

export default function KonterPurchasePage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<KonterSupplier[]>([]);
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [families, setFamilies] = useState<KonterProductFamily[]>([]);
  const [loading, setLoading] = useState(true);

  // State Modal Form PO Baru
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [items, setItems] = useState<{ sku: string; name: string; quantity: number; capitalPrice: number }[]>([]);
  
  // State Modal Cancel PO
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingPoId, setCancellingPoId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string }>({ show: false, title: "", message: "" });

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pos, supps, prods, fams] = await Promise.all([
        operationalService.getPurchaseOrders(),
        supplierOperationalService.getSuppliers(),
        operationalService.getProducts(),
        operationalService.getFamilies()
      ]);
      setPurchaseOrders(pos as any);
      setSuppliers(supps);
      setProducts(prods);
      setFamilies(fams);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data PO: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  const physicalVoucherProducts = products.filter(p => {
    const fam = families.find(f => f.code === p.familyCode);
    const isVoucherFam = fam && /voucher|fisik/i.test(fam.name + fam.code);
    return p.stockCategory === "FISIK" || isVoucherFam;
  });

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.supplierCode.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  function handleAddItem(productSku: string) {
    const prod = physicalVoucherProducts.find(p => p.sku === productSku);
    if (!prod) return;

    // CEK DUPLIKAT ITEM DALAM PO
    if (items.some(i => i.sku === prod.sku)) {
      setAlertModal({
        show: true,
        title: "Produk Sudah Termasuk",
        message: `Produk [${prod.sku} - ${prod.name}] sudah termasuk dalam daftar item PO ini.`
      });
      return;
    }

    setItems([...items, {
      sku: prod.sku,
      name: prod.name,
      quantity: 1,
      capitalPrice: prod.capitalPrice || 0
    }]);
  }

  function handleRemoveItem(sku: string) {
    setItems(items.filter(i => i.sku !== sku));
  }

  function handleItemChange(sku: string, field: "quantity" | "capitalPrice", val: number) {
    setItems(items.map(i => i.sku === sku ? { ...i, [field]: Math.max(0, val) } : i));
  }

  async function handleCreatePO(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplier) {
      setMsg({ type: "error", text: "Silakan pilih pemasok/supplier terlebih dahulu." });
      return;
    }
    if (items.length === 0) {
      setMsg({ type: "error", text: "Tambahkan minimal 1 item produk fisik/voucher ke dalam PO." });
      return;
    }

    const suppObj = suppliers.find(s => s.supplierCode === selectedSupplier || s.name === selectedSupplier);
    const supplierName = suppObj ? `${suppObj.supplierCode} - ${suppObj.name}` : selectedSupplier;

    setSubmitting(true);
    setMsg(null);
    try {
      await operationalService.createPurchaseOrder({
        supplierName,
        orderDate: new Date().toISOString(),
        items: items.map(i => ({ ...i, receivedQuantity: 0, subtotal: i.quantity * i.capitalPrice })),
        notes: poNotes
      });
      setMsg({ type: "success", text: "Purchase Order berhasil dibuat." });
      setIsModalOpen(false);
      setSelectedSupplier("");
      setSupplierSearch("");
      setItems([]);
      setPoNotes("");
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancellingPoId || !cancelReason.trim()) {
      alert("Alasan pembatalan wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      await operationalService.cancelPurchaseOrder(cancellingPoId, cancelReason, "Admin Konter");
      setMsg({ type: "success", text: "Purchase Order berhasil dibatalkan." });
      setIsCancelModalOpen(false);
      setCancellingPoId(null);
      setCancelReason("");
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Purchase Order (PO)</h1>
          <p className="text-xs text-slate-500">Buat pesanan pembelian khusus produk fisik &amp; voucher ke supplier terdaftar.</p>
        </div>
        <button
          onClick={() => {
            if (physicalVoucherProducts.length === 0) {
              alert("Belum ada produk dengan kategori Fisik / Voucher yang tersedia untuk dibuatkan PO.");
              return;
            }
            setSelectedSupplier("");
            setSupplierSearch("");
            setItems([]);
            setPoNotes("");
            setIsModalOpen(true);
          }}
          className="px-3.5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm transition"
        >
          + Buat Purchase Order Baru
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Tabel Daftar PO */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">No. PO</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Supplier</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Total Nominal</th>
                <th className="p-3">Catatan / Alasan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">Memuat data Purchase Order...</td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">Belum ada dokumen Purchase Order.</td>
                </tr>
              ) : (
                purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{po.poNumber}</td>
                    <td className="p-3 font-mono">{po.orderDate ? new Date(po.orderDate).toLocaleDateString("id-ID") : "-"}</td>
                    <td className="p-3 font-bold text-slate-900">{po.supplierName}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        po.status === "COMPLETED" ? "bg-emerald-100 text-emerald-900" :
                        po.status === "PARTIALLY_RECEIVED" ? "bg-amber-100 text-amber-900" :
                        po.status === "CANCELLED" ? "bg-rose-100 text-rose-900 line-through" : "bg-blue-100 text-blue-900"
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">Rp {po.totalAmount.toLocaleString("id-ID")}</td>
                    <td className="p-3 text-slate-600 max-w-xs truncate">{po.notes || "-"}</td>
                    <td className="p-3 text-center">
                      {po.status !== "COMPLETED" && po.status !== "CANCELLED" && (
                        <button
                          onClick={() => {
                            setCancellingPoId(po.id || null);
                            setCancelReason("");
                            setIsCancelModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs"
                        >
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

      {/* Modal Buat PO Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-rose-100 w-full max-w-2xl p-5 text-slate-900 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Buat Purchase Order Baru (Khusus Fisik / Voucher)</h2>
            <form onSubmit={handleCreatePO} className="space-y-4">
              
              <div className="space-y-1">
                <label className="block text-slate-900 font-semibold">Pilih Supplier <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  placeholder="Ketik nama atau kode supplier..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white mb-1"
                />
                <select
                  required
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium"
                >
                  <option value="">-- Pilih dari hasil pencarian / daftar supplier --</option>
                  {filteredSuppliers.map(s => (
                    <option key={s.id} value={s.supplierCode}>
                      {s.supplierCode} - {s.name} ({s.phone || "Tanpa Telp"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 border-t border-rose-100 pt-3">
                <div className="flex justify-between items-center">
                  <label className="block text-slate-900 font-semibold">Tambah Item Barang (Fisik / Voucher)</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItem(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="p-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white"
                  >
                    <option value="">+ Pilih produk untuk ditambahkan</option>
                    {physicalVoucherProducts.map(p => (
                      <option key={p.id} value={p.sku}>{p.sku} - {p.name}</option>
                    ))}
                  </select>
                </div>

                {items.length === 0 ? (
                  <div className="p-4 bg-slate-50 border rounded-lg text-center text-slate-400">
                    Belum ada item barang fisik/voucher yang dimasukkan dalam PO.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-100 border-b text-[11px] font-bold text-slate-700">
                          <th className="p-2">SKU / Nama</th>
                          <th className="p-2 w-24">Qty</th>
                          <th className="p-2 w-32">Harga Modal</th>
                          <th className="p-2 text-right w-28">Subtotal</th>
                          <th className="p-2 text-center w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-xs">
                        {items.map((i, idx) => (
                          <tr key={`${i.sku}-${idx}`}>
                            <td className="p-2">
                              <span className="font-mono font-bold text-[#BE185D] block">{i.sku}</span>
                              <span className="font-semibold text-slate-900">{i.name}</span>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={i.quantity}
                                onChange={(e) => handleItemChange(i.sku, "quantity", Number(e.target.value))}
                                className="w-full p-1 border rounded font-mono text-center font-bold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={i.capitalPrice}
                                onChange={(e) => handleItemChange(i.sku, "capitalPrice", Number(e.target.value))}
                                className="w-full p-1 border rounded font-mono"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold">
                              Rp {(i.quantity * i.capitalPrice).toLocaleString("id-ID")}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(i.sku)}
                                className="text-rose-600 hover:text-rose-800 font-bold"
                              >
                                X
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-900 font-semibold mb-1">Catatan PO (Opsional)</label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-rose-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm"
                >
                  {submitting ? "Menyimpan..." : "Simpan Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alert Bertema WMS */}
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

      {/* Modal Pembatalan PO dengan Alasan Wajib */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-rose-100 w-full max-w-md p-5 text-slate-900">
            <h2 className="text-sm font-bold text-rose-700 mb-2">Batalkan Dokumen Purchase Order</h2>
            <p className="text-xs text-slate-600 mb-3">Tindakan ini akan mengubah status PO menjadi dibatalkan. Harap isi alasan pembatalan secara rinci.</p>
            <form onSubmit={handleConfirmCancel} className="space-y-3">
              <div>
                <label className="block text-slate-900 font-semibold mb-1">Alasan Pembatalan <span className="text-rose-600">*Wajib</span></label>
                <textarea
                  required
                  rows={3}
                  placeholder="Masukkan alasan pembatalan PO..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-rose-100">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm"
                >
                  {submitting ? "Memproses..." : "Konfirmasi Pembatalan PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}