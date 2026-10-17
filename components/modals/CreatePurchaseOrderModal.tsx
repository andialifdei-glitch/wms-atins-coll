"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatRupiah } from "@/lib/formatters";

interface Props {
  isOpen: boolean;
  products: any[];
  suppliers: any[];
  onClose: () => void;
  onSubmitPo: (payload: any) => Promise<void>;
  showAlert: (msg: string, title?: string) => void;
}

export default function CreatePurchaseOrderModal({
  isOpen,
  products,
  suppliers,
  onClose,
  onSubmitPo,
  showAlert,
}: Props) {
  // Supplier State (Dimulai kosong/clean)
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Product State
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [inputQty, setInputQty] = useState(1);
  const [inputHpp, setInputHpp] = useState(0);

  // Items PO & Notes
  const [poItems, setPoItems] = useState<any[]>([]);
  const [notes, setNotes] = useState("");

  // Confirmation & Submit State
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset form setiap kali modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSelectedSupplier(null);
      setSupplierSearch("");
      setShowSupplierDropdown(false);
      setProductSearch("");
      setSelectedProduct(null);
      setShowProductDropdown(false);
      setInputQty(1);
      setInputHpp(0);
      setPoItems([]);
      setNotes("");
      setShowConfirmDialog(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  // Filter daftar supplier berdasarkan ketikan di searchbar
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers.filter((s) => s.active !== false);
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.active !== false &&
        ((s.supplierName || "").toLowerCase().includes(q) ||
          (s.supplierId || "").toLowerCase().includes(q) ||
          (s.phone || "").toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearch]);

  // Filter produk: HANYA produk aktif yang terdaftar di bawah supplier terpilih
  const filteredProducts = useMemo(() => {
    if (!selectedSupplier) return [];

    const suppId = String(selectedSupplier.supplierId || selectedSupplier.id || "").toLowerCase();
    const suppName = String(selectedSupplier.supplierName || "").toLowerCase();

    return products.filter((p) => {
      if (p.active === false) return false;

      const pSuppId = String(p.supplierId || "").toLowerCase();
      const pSuppName = String(p.supplierName || "").toLowerCase();

      const matchesSupplier =
        (suppId && pSuppId === suppId) ||
        (suppName && pSuppName === suppName);

      if (!matchesSupplier) return false;

      if (!productSearch.trim()) return true;
      const q = productSearch.toLowerCase();
      return (
        (p.sku || "").toLowerCase().includes(q) ||
        (p.itemName || "").toLowerCase().includes(q)
      );
    });
  }, [products, selectedSupplier, productSearch]);

  const grandTotal = useMemo(() => {
    return poItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
  }, [poItems]);

  function handleSelectSupplier(s: any) {
    if (selectedSupplier && (selectedSupplier.supplierId || selectedSupplier.id) !== (s.supplierId || s.id)) {
      if (poItems.length > 0) {
        if (!confirm("Mengganti supplier akan mengosongkan item produk yang telah dipilih. Lanjutkan?")) {
          setShowSupplierDropdown(false);
          return;
        }
      }
      setPoItems([]);
    }
    setSelectedSupplier(s);
    setSupplierSearch(s.supplierName || "");
    setShowSupplierDropdown(false);
    setSelectedProduct(null);
    setProductSearch("");
  }

  function handleResetSupplier() {
    if (poItems.length > 0) {
      if (!confirm("Menghapus pilihan supplier akan mengosongkan daftar item pesanan. Lanjutkan?")) return;
    }
    setSelectedSupplier(null);
    setSupplierSearch("");
    setSelectedProduct(null);
    setProductSearch("");
    setPoItems([]);
  }

  function handleSelectProduct(prod: any) {
    setSelectedProduct(prod);
    setProductSearch(prod.itemName);
    setInputHpp(Number(prod.purchasingPrice || 0));
    setShowProductDropdown(false);
  }

  function handleAddItem() {
    if (!selectedSupplier) return showAlert("Pilih supplier terlebih dahulu!");
    if (!selectedProduct) return showAlert("Pilih produk terlebih dahulu!");
    if (inputQty <= 0) return showAlert("Kuantitas minimal 1 pcs!");

    const hpp = Number(inputHpp) || 0;
    const existIndex = poItems.findIndex((it) => it.sku === selectedProduct.sku);

    if (existIndex >= 0) {
      const updated = [...poItems];
      const newQty = updated[existIndex].qty + inputQty;
      updated[existIndex].qty = newQty;
      updated[existIndex].purchasingPrice = hpp;
      updated[existIndex].subtotal = newQty * hpp;
      setPoItems(updated);
    } else {
      setPoItems([
        ...poItems,
        {
          sku: selectedProduct.sku,
          itemName: selectedProduct.itemName,
          purchasingPrice: hpp,
          qty: inputQty,
          subtotal: inputQty * hpp,
        },
      ]);
    }

    setSelectedProduct(null);
    setProductSearch("");
    setInputQty(1);
    setInputHpp(0);
  }

  function handleRemoveItem(idx: number) {
    setPoItems(poItems.filter((_, i) => i !== idx));
  }

  function handleOpenConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplier) return showAlert("Pilih supplier terlebih dahulu!");
    if (poItems.length === 0) return showAlert("Tambahkan minimal 1 item pesanan produk!");
    setShowConfirmDialog(true);
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    try {
      await onSubmitPo({
        supplierId: selectedSupplier?.supplierId || selectedSupplier?.id || "",
        supplier: selectedSupplier?.supplierName || "-",
        supplierPhone: selectedSupplier?.phone || "-",
        supplierAddress: selectedSupplier?.address || "-",
        items: poItems,
        total: grandTotal,
        notes: notes.trim(),
      });
      setShowConfirmDialog(false);
      onClose();
    } catch (err: any) {
      showAlert(err.message || "Gagal membuat Purchase Order!");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[85] animate-fadeIn">
        <div className="bg-white rounded-xl w-full max-w-4xl p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto text-xs">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Buat Purchase Order (PO) Baru</h3>
              <p className="text-[11px] text-slate-500">Pemesanan barang ke supplier rekanan resmi</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            {/* 1. SEARCHBAR SUPPLIER (CLEAN & INTERAKTIF) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="relative">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Pilih Supplier Rekanan *</label>
                  {selectedSupplier && (
                    <button
                      type="button"
                      onClick={handleResetSupplier}
                      className="text-[10px] text-rose-600 hover:underline font-semibold"
                    >
                      Ganti Supplier
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Ketik nama atau kode supplier..."
                  value={supplierSearch}
                  onFocus={() => setShowSupplierDropdown(true)}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setShowSupplierDropdown(true);
                  }}
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white font-medium"
                />
                {showSupplierDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-30">
                    {filteredSuppliers.map((s) => (
                      <div
                        key={s.id || s.supplierId}
                        onClick={() => handleSelectSupplier(s)}
                        className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-semibold text-slate-900">{s.supplierName}</div>
                        <div className="text-[10px] text-slate-500">{s.supplierId || s.id} • {s.phone || "-"}</div>
                      </div>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <div className="p-2.5 text-center text-slate-400">Supplier tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                <div className="font-semibold text-slate-900">
                  {selectedSupplier ? selectedSupplier.supplierName : "Belum memilih supplier"}
                </div>
                <div className="text-slate-500 text-[11px] truncate mt-0.5">
                  {selectedSupplier
                    ? `${selectedSupplier.phone || "-"} • ${selectedSupplier.address || "Alamat belum diatur"}`
                    : "Pilih supplier terlebih dahulu untuk menampilkan katalog produk"}
                </div>
              </div>
            </div>

            {/* 2. PILIH PRODUK SESUAI SUPPLIER */}
            <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 text-xs">Pilih Produk &amp; Harga Beli (HPP)</span>
                {selectedSupplier && (
                  <span className="text-[11px] text-slate-500">
                    Tersedia: <b>{filteredProducts.length}</b> SKU terdaftar pada {selectedSupplier.supplierName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <div className="relative md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cari Produk {selectedSupplier ? `(${selectedSupplier.supplierName})` : ""}
                  </label>
                  <input
                    type="text"
                    disabled={!selectedSupplier}
                    placeholder={
                      selectedSupplier
                        ? "Ketik SKU atau nama produk..."
                        : "Pilih supplier terlebih dahulu..."
                    }
                    value={productSearch}
                    onFocus={() => {
                      if (selectedSupplier) setShowProductDropdown(true);
                    }}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      if (selectedSupplier) setShowProductDropdown(true);
                    }}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  {showProductDropdown && selectedSupplier && (
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                      {filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                        >
                          <div className="font-semibold text-slate-900">{p.sku} - {p.itemName}</div>
                          <div className="text-[10px] text-slate-500">
                            Stok Saat Ini: {p.stock} pcs • HPP Bawaan: {formatRupiah(p.purchasingPrice)}
                          </div>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div className="p-2.5 text-center text-slate-400">
                          Tidak ada produk yang terdaftar untuk supplier ini
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Beli / HPP (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={!selectedProduct}
                    value={inputHpp}
                    onChange={(e) => setInputHpp(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none font-bold text-slate-900 font-mono disabled:bg-slate-100"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="w-20">
                    <label className="block font-semibold text-slate-700 mb-1">Qty</label>
                    <input
                      type="number"
                      min="1"
                      disabled={!selectedProduct}
                      value={inputQty}
                      onChange={(e) => setInputQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none text-center font-bold disabled:bg-slate-100"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={handleAddItem}
                    className="flex-1 py-2 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-xs transition"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {/* TABEL ITEM PO */}
              <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Nama Barang</th>
                    <th className="p-2 text-right">Harga Beli / HPP</th>
                    <th className="p-2 text-center">Qty Pesan</th>
                    <th className="p-2 text-right">Subtotal</th>
                    <th className="p-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {poItems.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-mono font-bold text-slate-900">{it.sku}</td>
                      <td className="p-2 font-medium">{it.itemName}</td>
                      <td className="p-2 text-right">{formatRupiah(it.purchasingPrice)}</td>
                      <td className="p-2 text-center font-bold">{it.qty}</td>
                      <td className="p-2 text-right font-bold text-emerald-700">{formatRupiah(it.subtotal)}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-600 hover:text-rose-800 font-bold px-2"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                  {poItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        Belum ada item barang yang dimasukkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 3. CATATAN & TOTAL NILAI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruksi pengiriman atau catatan faktur..."
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
                />
              </div>

              <div className="flex flex-col items-end justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-slate-600">Total Nilai Pemesanan:</span>
                <span className="text-base font-bold text-emerald-700 mt-1">{formatRupiah(grandTotal)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold border border-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!selectedSupplier || poItems.length === 0}
                className="px-5 py-2 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-xs transition"
              >
                Terbitkan Purchase Order
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* DIALOG KONFIRMASI PEMBUATAN PO (Z-[100000] SELALU DI LAPISAN PALING DEPAN) */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-[100000] animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 text-center text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">Konfirmasi Pembuatan PO</h3>
            <p className="text-slate-600 mb-4 leading-relaxed">
              Terbitkan Purchase Order ke supplier <b>{selectedSupplier?.supplierName}</b> dengan total nilai <b>{formatRupiah(grandTotal)}</b> ({poItems.length} SKU)?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalSubmit}
                className="flex-1 py-2 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-400 text-white font-semibold rounded-lg shadow-xs transition"
              >
                {submitting ? "Menerbitkan..." : "Ya, Terbitkan PO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}