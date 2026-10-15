"use client";
import React, { useState, useMemo, useEffect } from "react";
import { formatRupiah } from "@/lib/formatters";

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  products: any[];
  suppliers?: any[];
  onClose: () => void;
  onSubmitPo: (payload: {
    supplierId?: string;
    supplier: string;
    address: string;
    phone: string;
    notes: string;
    items: any[];
  }) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function CreatePurchaseOrderModal({
  isOpen,
  products,
  suppliers = [],
  onClose,
  onSubmitPo,
  showAlert,
}: CreatePurchaseOrderModalProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [poItems, setPoItems] = useState<any[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Reset state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSelectedSupplierId("");
      setSupplierName("");
      setAddress("");
      setPhone("");
      setNotes("");
      setProductSearch("");
      setPoItems([]);
      setIsConfirmOpen(false);
    }
  }, [isOpen]);

  // Handler saat dropdown supplier berubah
  const handleSupplierChange = (suppId: string) => {
    if (poItems.length > 0 && suppId !== selectedSupplierId) {
      const confirmReset = window.confirm(
        "Mengganti supplier akan mengosongkan item barang yang sudah dipilih. Lanjutkan?"
      );
      if (!confirmReset) return;
      setPoItems([]);
    }

    setSelectedSupplierId(suppId);
    const target = suppliers.find(
      (s) => (s.supplierId || s.documentNo || s.id) === suppId
    );
    if (target) {
      setSupplierName(target.supplierName || "");
      setPhone(target.phone || "-");
      setAddress(target.address || "-");
    } else {
      setSupplierName("");
      setPhone("");
      setAddress("");
    }
    setProductSearch("");
  };

  // Filter produk: HANYA yang aktif dan memiliki supplierId yang sama dengan supplier terpilih
  const availableProductsForSupplier = useMemo(() => {
    if (!selectedSupplierId) return [];
    return products.filter(
      (p) =>
        p.active !== false &&
        (p.supplierId === selectedSupplierId ||
          p.supplierName === supplierName)
    );
  }, [products, selectedSupplierId, supplierName]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return availableProductsForSupplier
      .filter(
        (p) =>
          (p.sku || "").toLowerCase().includes(q) ||
          (p.itemName || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [availableProductsForSupplier, productSearch]);

  if (!isOpen) return null;

  const totalNilai = poItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-rose-100 max-h-[90vh] overflow-y-auto">
          <div className="border-b border-rose-100 pb-2 mb-4">
            <h3 className="text-base font-bold text-rose-950">Buat Purchase Order (PO) Baru</h3>
            <p className="text-xs text-rose-500 font-mono">Format Dokumen: PO-YYYYMMDD-XXXXX</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedSupplierId) return showAlert("Silakan pilih Supplier Rekanan terlebih dahulu!");
              if (poItems.length === 0) return showAlert("Tambahkan minimal 1 item barang ke dalam PO!");
              setIsConfirmOpen(true);
            }}
            className="space-y-4 text-xs"
          >
            {/* Bagian Pemilihan Supplier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
              <div className="md:col-span-2">
                <label className="block font-bold text-rose-950 mb-1">
                  Pilih Supplier Rekanan *
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className="w-full p-2.5 border border-rose-200 rounded-lg bg-white outline-none font-semibold text-rose-950"
                >
                  <option value="">-- Pilih Supplier Rekanan --</option>
                  {suppliers
                    .filter((s) => s.active !== false)
                    .map((s) => (
                      <option
                        key={s.supplierId || s.id}
                        value={s.supplierId || s.id}
                      >
                        [{s.supplierId || s.documentNo}] {s.supplierName}
                      </option>
                    ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Belum ada data supplier rekanan di database. Tambahkan di menu User Management -&gt; Supplier.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-rose-900 mb-1">No. Handphone / WhatsApp</label>
                <div className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 font-mono text-slate-700 select-none">
                  {phone || <span className="text-slate-400 italic">Otomatis dari data supplier</span>}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-rose-900 mb-1">Alamat Supplier</label>
                <div className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-700 select-none min-h-[38px] break-words">
                  {address || <span className="text-slate-400 italic">Otomatis dari data supplier</span>}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Catatan Tambahan PO</label>
              <input
                type="text"
                placeholder="misal: Estimasi tiba 3 hari kerja, kirim ke Gudang Utama"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>

            {/* Bagian Pencarian Barang Terikat Supplier */}
            <div className="border-t border-rose-100 pt-3">
              <label className="block font-semibold text-rose-900 mb-1">
                Cari & Tambah SKU Barang (Hanya Katalog Supplier Terpilih)
              </label>

              {!selectedSupplierId ? (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-center font-medium">
                  ⚠️ Silakan pilih <b>Supplier Rekanan</b> di atas terlebih dahulu untuk menampilkan daftar SKU terkait.
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={`Ketik nama atau SKU milik ${supplierName}...`}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                  />

                  {productSearch.trim() && (
                    <div className="mt-1 max-h-44 overflow-y-auto border border-rose-200 rounded-lg bg-white shadow-lg divide-y divide-rose-50">
                      {filteredProducts.map((p) => (
                        <div
                          key={p.sku}
                          onClick={() => {
                            const existingIdx = poItems.findIndex((it) => it.sku === p.sku);
                            if (existingIdx > -1) {
                              setPoItems((prev) =>
                                prev.map((item, idx) =>
                                  idx === existingIdx
                                    ? {
                                        ...item,
                                        quantity: item.quantity + 1,
                                        subtotal: (item.quantity + 1) * item.purchasingPrice,
                                      }
                                    : item
                                )
                              );
                            } else {
                              setPoItems((prev) => [
                                ...prev,
                                {
                                  sku: p.sku,
                                  itemName: p.itemName,
                                  purchasingPrice: Number(p.purchasingPrice) || 0,
                                  quantity: 1,
                                  subtotal: Number(p.purchasingPrice) || 0,
                                },
                              ]);
                            }
                            setProductSearch("");
                          }}
                          className="p-2 hover:bg-rose-50 cursor-pointer flex justify-between items-center transition"
                        >
                          <div>
                            <span className="font-bold font-mono text-rose-950">{p.sku}</span>
                            <span className="text-slate-600 ml-2">{p.itemName}</span>
                          </div>
                          <div className="font-bold text-[#BE185D]">
                            {formatRupiah(Number(p.purchasingPrice) || 0)}
                          </div>
                        </div>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div className="p-3 text-center text-slate-400">
                          Tidak ditemukan SKU aktif yang terdaftar di bawah supplier {supplierName}.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 mt-1">
                    Tersedia {availableProductsForSupplier.length} SKU katalog terdaftar untuk supplier ini.
                  </div>
                </>
              )}
            </div>

            {/* Tabel Item PO */}
            <div>
              <label className="block font-semibold text-rose-900 mb-1">Daftar Barang Masuk PO</label>
              <div className="border border-rose-200 rounded-lg overflow-hidden">
                {poItems.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">Belum ada barang dimasukkan ke PO.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2">SKU & Barang</th>
                          <th className="p-2 w-28 text-center">Qty Pesan</th>
                          <th className="p-2 text-right">Harga HPP</th>
                          <th className="p-2 text-right">Subtotal</th>
                          <th className="p-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {poItems.map((it, idx) => (
                          <tr key={it.sku}>
                            <td className="p-2">
                              <div className="font-mono font-bold text-rose-900">{it.sku}</div>
                              <div className="text-[11px] text-slate-600">{it.itemName}</div>
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={it.quantity}
                                onChange={(e) => {
                                  const q = Math.max(1, parseInt(e.target.value) || 1);
                                  setPoItems((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, quantity: q, subtotal: q * item.purchasingPrice }
                                        : item
                                    )
                                  );
                                }}
                                className="w-16 p-1 border border-rose-200 rounded text-center font-bold outline-none"
                              />
                            </td>
                            <td className="p-2 text-right font-mono text-slate-700">
                              {formatRupiah(it.purchasingPrice)}
                            </td>
                            <td className="p-2 text-right font-bold text-rose-950">
                              {formatRupiah(it.subtotal)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:text-red-700 font-bold text-base"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Total Nilai PO */}
            <div className="flex justify-between items-center bg-rose-50 p-3 rounded-lg border border-rose-100">
              <span className="font-semibold text-rose-900">Total Nilai PO:</span>
              <b className="text-emerald-700 text-sm">{formatRupiah(totalNilai)}</b>
            </div>

            {/* Tombol Aksi */}
            <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={poItems.length === 0}
                className="px-5 py-2 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white rounded-lg font-bold shadow"
              >
                Terbitkan PO
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Alert Konfirmasi Penerbitan PO */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-200 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-2">Konfirmasi Penerbitan PO</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Apakah rincian pesanan Purchase Order ke supplier <b>{supplierName}</b> ([{selectedSupplierId}]) sejumlah{" "}
              <b>{poItems.length} macam barang</b> dengan total <b>{formatRupiah(totalNilai)}</b> sudah sesuai?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Periksa Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmOpen(false);
                  onSubmitPo({
                    supplierId: selectedSupplierId,
                    supplier: supplierName,
                    address,
                    phone,
                    notes,
                    items: poItems,
                  });
                }}
                className="flex-1 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-xl shadow"
              >
                Konfirmasi Terbitkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}