"use client";
import React, { useState, useMemo } from "react";
import { formatRupiah } from "@/lib/formatters";

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  products: any[];
  onClose: () => void;
  onSubmitPo: (payload: { supplier: string; address: string; phone: string; notes: string; items: any[] }) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function CreatePurchaseOrderModal({
  isOpen,
  products,
  onClose,
  onSubmitPo,
  showAlert,
}: CreatePurchaseOrderModalProps) {
  const [supplier, setSupplier] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [poItems, setPoItems] = useState<any[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.active !== false && ((p.sku || "").toLowerCase().includes(q) || (p.itemName || "").toLowerCase().includes(q)))
      .slice(0, 6);
  }, [products, productSearch]);

  if (!isOpen) return null;

  const totalNilai = poItems.reduce((acc, it) => acc + it.subtotal, 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-rose-100 max-h-[90vh] overflow-y-auto">
          <h3 className="text-base font-bold text-rose-950 mb-1">Buat Purchase Order (PO) Baru</h3>
          <p className="text-xs text-rose-500 font-mono mb-4">Format Dokumen: PO-YYYYMMDD-XXXXX</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!supplier.trim()) return showAlert("Nama supplier/vendor wajib diisi!");
              if (poItems.length === 0) return showAlert("Tambahkan minimal 1 item barang ke dalam PO!");
              setIsConfirmOpen(true);
            }}
            className="space-y-3.5 text-xs"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Nama Supplier / Vendor</label>
                <input
                  type="text"
                  required
                  placeholder="misal: PT Tekstil Bandung Maju"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-rose-900 mb-1">No. Handphone / Telepon</label>
                <input
                  type="text"
                  placeholder="0812xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Alamat Supplier</label>
                <input
                  type="text"
                  placeholder="Alamat lengkap supplier..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Catatan pesanan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
            </div>

            {/* Pencarian Barang PO */}
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-2">
              <label className="block font-bold text-rose-900">Cari Produk untuk Dipesan</label>
              <input
                type="text"
                placeholder="Ketik SKU atau Nama Produk..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none"
              />

              {filteredProducts.length > 0 && (
                <div className="border border-rose-200 rounded-lg bg-white divide-y divide-rose-100">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        const existingIdx = poItems.findIndex((it) => it.sku === p.sku);
                        const buyPrice = Number(p.purchasingPrice || 0);
                        if (existingIdx >= 0) {
                          setPoItems((prev) =>
                            prev.map((it, i) =>
                              i === existingIdx ? { ...it, qty: it.qty + 10, subtotal: (it.qty + 10) * it.purchasingPrice } : it
                            )
                          );
                        } else {
                          setPoItems((prev) => [
                            ...prev,
                            {
                              sku: p.sku,
                              itemName: p.itemName,
                              qty: 10,
                              purchasingPrice: buyPrice,
                              subtotal: 10 * buyPrice,
                              weightInGrams: p.weightInGrams || 0,
                            },
                          ]);
                        }
                        setProductSearch("");
                      }}
                      className="p-2 hover:bg-rose-50 cursor-pointer flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold">{p.itemName}</span>
                        <span className="text-[10px] text-slate-500 font-mono ml-2">({p.sku})</span>
                      </div>
                      <span className="font-bold text-rose-900">{formatRupiah(Number(p.purchasingPrice || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabel Item PO dengan Input Qty Fleksibel */}
            <div className="max-h-44 overflow-y-auto border border-rose-100 rounded-lg divide-y divide-rose-50">
              {poItems.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Belum ada barang dimasukkan ke PO.</div>
              ) : (
                poItems.map((it, idx) => (
                  <div key={it.sku} className="p-2.5 flex justify-between items-center gap-2">
                    <div className="flex-1">
                      <div className="font-bold">{it.itemName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{it.sku}</div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) => {
                          const newQty = Math.max(1, Number(e.target.value));
                          setPoItems((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, qty: newQty, subtotal: newQty * item.purchasingPrice } : item
                            )
                          );
                        }}
                        className="w-16 p-1 border border-rose-200 rounded text-center font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">HPP:</span>
                      <input
                        type="number"
                        min="0"
                        value={it.purchasingPrice}
                        onChange={(e) => {
                          const newPrice = Number(e.target.value);
                          setPoItems((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, purchasingPrice: newPrice, subtotal: item.qty * newPrice } : item
                            )
                          );
                        }}
                        className="w-24 p-1 border border-rose-200 rounded text-center font-bold"
                      />
                    </div>

                    <div className="w-24 text-right font-bold text-emerald-600">{formatRupiah(it.subtotal)}</div>

                    <button
                      type="button"
                      onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                      className="text-red-600 font-bold px-1.5"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-rose-100 flex justify-between items-center">
              <div>
                Total Nilai PO: <b className="text-emerald-700 text-sm">{formatRupiah(totalNilai)}</b>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded-lg font-bold shadow"
                >
                  Terbitkan PO
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Alert Konfirmasi Penerbitan PO */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-200 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-2">Konfirmasi Penerbitan PO</h3>
            <p className="text-xs text-rose-700 mb-6 font-medium">
              Apakah rincian pesanan Purchase Order ke supplier <b>{supplier}</b> sudah sesuai?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Periksa Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmOpen(false);
                  onSubmitPo({ supplier, address, phone, notes, items: poItems });
                }}
                className="px-5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-xl shadow"
              >
                Ya, Sudah Sesuai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}