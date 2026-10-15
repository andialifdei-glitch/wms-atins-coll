"use client";
import React, { useState, useEffect } from "react";

interface ProductModalProps {
  isOpen: boolean;
  isEditing: boolean;
  families: any[];
  suppliers?: any[];
  initialData: any;
  onClose: () => void;
  onConfirmSave: (data: any) => void;
}

export default function ProductModal({
  isOpen,
  isEditing,
  families,
  suppliers = [],
  initialData,
  onClose,
  onConfirmSave,
}: ProductModalProps) {
  const [formData, setFormData] = useState(initialData);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!isConfirmOpen) {
      setCountdown(5);
      return;
    }
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmOpen, countdown]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl border border-rose-100 max-h-[90vh] flex flex-col">
          <div className="border-b border-rose-100 pb-2 mb-3">
            <h3 className="text-sm font-bold text-rose-950">
              {isEditing ? "Edit Parameter Produk" : "Tambah Produk Baru"}
            </h3>
            <p className="text-[11px] text-rose-500">
              {isEditing
                ? "SKU dan Family Code bersifat permanen dan tidak dapat diubah."
                : "Pilih Family dan Supplier untuk relasi katalog barang."}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsConfirmOpen(true);
            }}
            className="space-y-3 text-xs overflow-y-auto flex-1 pr-1"
          >
            {isEditing && (
              <div>
                <label className="block font-semibold text-rose-900 mb-1">SKU Produk</label>
                <input
                  type="text"
                  disabled
                  value={formData.sku || ""}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 font-mono font-bold text-slate-700 outline-none select-none cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Nama Produk / Barang *</label>
              <input
                type="text"
                required
                placeholder="misal: Kerudung Bella Square Maroon"
                value={formData.itemName || ""}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Family Category *</label>
                <select
                  disabled={isEditing}
                  value={formData.familyCode || ""}
                  onChange={(e) => setFormData({ ...formData, familyCode: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                >
                  <option value="">-- Pilih Family --</option>
                  {families.map((f) => (
                    <option key={f.id || f.familyCode} value={f.familyCode}>
                      {f.familyCode} - {f.familyName || f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-rose-900 mb-1">Supplier Rekanan</label>
                <select
                  value={formData.supplierId || ""}
                  onChange={(e) => {
                    const supp = suppliers.find((s) => s.supplierId === e.target.value || s.id === e.target.value);
                    setFormData({
                      ...formData,
                      supplierId: e.target.value,
                      supplierName: supp ? supp.supplierName : "",
                    });
                  }}
                  className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none"
                >
                  <option value="">-- Tanpa Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id || s.supplierId} value={s.supplierId || s.id}>
                      {s.supplierId || s.documentNo} - {s.supplierName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-rose-900 mb-1">HPP / Beli (Rp) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.purchasingPrice ?? 0}
                  onChange={(e) => setFormData({ ...formData, purchasingPrice: Number(e.target.value) })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-rose-900 mb-1">Harga Jual (Rp) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.netPrice ?? 0}
                  onChange={(e) => setFormData({ ...formData, netPrice: Number(e.target.value) })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none font-bold text-[#BE185D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Berat Satuan (Gram)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="100"
                  value={formData.weightInGrams ?? 0}
                  onChange={(e) => setFormData({ ...formData, weightInGrams: Number(e.target.value) })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>

              {!isEditing && (
                <div>
                  <label className="block font-semibold text-rose-900 mb-1">Stok Awal Fisik</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.initialStock ?? 0}
                    onChange={(e) => setFormData({ ...formData, initialStock: Number(e.target.value) })}
                    className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Status Keaktifan SKU</label>
              <select
                value={formData.active !== false ? "ACTIVE" : "INACTIVE"}
                onChange={(e) => setFormData({ ...formData, active: e.target.value === "ACTIVE" })}
                className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none font-bold"
              >
                <option value="ACTIVE">Aktif (Bisa Ditransaksikan)</option>
                <option value="INACTIVE">Nonaktif (Diarsipkan)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-rose-100">
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
                Simpan
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CONFIRMATION POPUP */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-200 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-2">Konfirmasi Simpan Produk</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Pastikan data <b>{formData.itemName}</b> dan relasi supplier sudah benar sebelum disimpan ke katalog.
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
                disabled={countdown > 0}
                onClick={() => {
                  setIsConfirmOpen(false);
                  onConfirmSave(formData);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold text-white shadow transition ${
                  countdown > 0 ? "bg-slate-400 cursor-not-allowed" : "bg-[#BE185D] hover:bg-[#9D174D]"
                }`}
              >
                {countdown > 0 ? `Tunggu (${countdown}s)` : "Konfirmasi Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}