"use client";
import React, { useState, useMemo } from "react";

interface StockAdjustmentModalProps {
  isOpen: boolean;
  products: any[];
  onClose: () => void;
  onExecuteAdjustment: (formData: any) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function StockAdjustmentModal({
  isOpen,
  products,
  onClose,
  onExecuteAdjustment,
  showAlert,
}: StockAdjustmentModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    sku: "",
    type: "INCREASE",
    qty: 1,
    reason: "",
    notes: "",
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        (p.sku || "").toLowerCase().includes(q) ||
        (p.itemName || "").toLowerCase().includes(q)
    ).slice(0, 6);
  }, [products, searchQuery]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-rose-100">
          <h3 className="text-base font-bold text-rose-950 mb-1">Buat Penyesuaian Stok (Adjustment)</h3>
          <p className="text-xs text-rose-500 font-mono mb-4">Format Dokumen: Adj-YYYYMMDD-XXXX</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedProduct) return showAlert("Pilih produk melalui searchbar terlebih dahulu!");
              setIsConfirmOpen(true);
            }}
            className="space-y-3.5 text-xs"
          >
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-2">
              <label className="block font-bold text-rose-900">Cari Produk (Searchbar)</label>
              <input
                type="text"
                placeholder="Ketik SKU atau Nama Produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 border border-rose-200 rounded-lg text-xs bg-white outline-none"
              />

              {filteredProducts.length > 0 && (
                <div className="border border-rose-200 rounded-lg bg-white divide-y divide-rose-100 text-xs">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setFormData((prev) => ({ ...prev, sku: p.sku }));
                        setSearchQuery("");
                      }}
                      className="p-2 hover:bg-rose-50 cursor-pointer flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold">{p.itemName}</span>
                        <span className="text-[10px] text-slate-500 font-mono ml-2">({p.sku})</span>
                      </div>
                      <span className="font-bold text-emerald-600">Stok: {p.stock || 0} pcs</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedProduct ? (
                <div className="p-2.5 bg-white rounded-lg border border-rose-200 text-xs flex justify-between items-center">
                  <div>
                    <div className="font-bold text-rose-950">{selectedProduct.itemName}</div>
                    <div className="text-[10px] font-mono text-slate-500">SKU: {selectedProduct.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Stok Saat Ini</div>
                    <div className="font-bold text-emerald-600">{selectedProduct.stock || 0} pcs</div>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-red-600 font-medium">* Belum ada produk dipilih.</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Tipe Penyesuaian</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg bg-white font-bold outline-none"
                >
                  <option value="INCREASE">INCREASE (Tambah)</option>
                  <option value="DECREASE">DECREASE (Kurang)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Jumlah (Qty)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: Math.max(1, Number(e.target.value)) })}
                  className="w-full p-2 border border-rose-200 rounded-lg font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Alasan Penyesuaian (Wajib)</label>
              <input
                type="text"
                required
                placeholder="misal: Selisih fisik packing / barang cacat"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Catatan Tambahan (Opsional)</label>
              <textarea
                rows={2}
                placeholder="Keterangan pendukung..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded-lg font-bold shadow"
              >
                Lanjut & Periksa
              </button>
            </div>
          </form>
        </div>
      </div>

      {isConfirmOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-200 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-rose-950 mb-2">Konfirmasi Perubahan Stok</h3>
            <p className="text-xs text-rose-900 mb-4 leading-relaxed text-left bg-rose-50 p-3 rounded-lg border border-rose-100">
              Produk: <b>{selectedProduct.itemName}</b><br />
              SKU: <span className="font-mono">{selectedProduct.sku}</span><br />
              Penyesuaian: <b className={formData.type === "INCREASE" ? "text-emerald-700" : "text-red-700"}>
                {formData.type} ({formData.type === "INCREASE" ? `+${formData.qty}` : `-${formData.qty}`} pcs)
              </b><br />
              Alasan: {formData.reason}
            </p>
            <p className="text-xs text-slate-600 mb-6 font-medium">
              Apakah rincian perubahan saldo stok sudah sesuai?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cek Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmOpen(false);
                  onExecuteAdjustment(formData);
                }}
                className="px-5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-xl shadow"
              >
                OK, Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}