"use client";
import React, { useState, useEffect } from "react";

interface ProductModalProps {
  isOpen: boolean;
  isEditing: boolean;
  families: any[];
  initialData: any;
  onClose: () => void;
  onConfirmSave: (data: any) => void;
}

export default function ProductModal({
  isOpen,
  isEditing,
  families,
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
        <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl border border-rose-100">
          <h3 className="text-sm font-bold text-rose-950 mb-1">
            {isEditing ? "Edit Parameter Produk" : "Tambah Produk Baru"}
          </h3>
          <p className="text-[11px] text-rose-500 mb-3">
            {isEditing
              ? "SKU dan Family Code bersifat permanen dan tidak dapat diubah."
              : "Pilih Family untuk menghasilkan SKU secara otomatis."}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setIsConfirmOpen(true);
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label className="block font-semibold text-rose-900 mb-1 flex justify-between">
                <span>Family Code</span>
                {isEditing && <span className="text-[10px] text-slate-400 font-normal">Terkunci (Disable)</span>}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  disabled
                  value={formData.familyCode}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-mono font-bold cursor-not-allowed select-none outline-none"
                />
              ) : (
                <select
                  required
                  value={formData.familyCode}
                  onChange={(e) => setFormData({ ...formData, familyCode: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none"
                >
                  <option value="">-- Pilih Family --</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.familyCode}>{f.familyName} ({f.familyCode})</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1 flex justify-between">
                <span>SKU Produk</span>
                <span className="text-[10px] text-slate-400 font-normal">Terkunci (Disable)</span>
              </label>
              <input
                type="text"
                disabled
                value={formData.sku || "Otomatis di-generate"}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-mono font-bold cursor-not-allowed select-none outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Nama Produk</label>
              <input
                type="text"
                required
                placeholder="Ketik nama produk..."
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Harga Beli (HPP)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.purchasingPrice}
                  onChange={(e) => setFormData({ ...formData, purchasingPrice: Number(e.target.value) })}
                  className="w-full p-2 border border-rose-200 rounded-lg font-bold outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-rose-900 mb-1">Harga Jual</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.netPrice}
                  onChange={(e) => setFormData({ ...formData, netPrice: Number(e.target.value) })}
                  className="w-full p-2 border border-rose-200 rounded-lg font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Status Produk</label>
              <select
                value={formData.active ? "true" : "false"}
                onChange={(e) => setFormData({ ...formData, active: e.target.value === "true" })}
                className="w-full p-2 border border-rose-200 rounded-lg bg-white font-bold text-rose-950 outline-none"
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>

            {!isEditing && (
              <div>
                <label className="block font-bold text-amber-950 mb-1">Stok Awal Fisik</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.initialStock}
                  onChange={(e) => setFormData({ ...formData, initialStock: Number(e.target.value) })}
                  className="w-full p-2 border border-amber-300 rounded text-xs bg-amber-50/50 font-bold"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded shadow"
              >
                {isEditing ? "Simpan Perubahan" : "Simpan Produk"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-200 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-2">Konfirmasi Parameter Produk</h3>
            <p className="text-xs text-rose-700 mb-6 font-medium">Apakah perubahan data produk sudah sesuai?</p>
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
                disabled={countdown > 0}
                onClick={() => {
                  setIsConfirmOpen(false);
                  onConfirmSave(formData);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition text-white ${
                  countdown > 0 ? "bg-slate-400 cursor-not-allowed" : "bg-[#BE185D] hover:bg-[#9D174D] shadow"
                }`}
              >
                {countdown > 0 ? `OK (${countdown}s)` : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}