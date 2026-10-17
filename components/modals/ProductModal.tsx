"use client";

import React, { useState, useEffect } from "react";

interface Props {
  isOpen: boolean;
  isEditing: boolean;
  families: any[];
  suppliers: any[];
  initialData: any;
  onClose: () => void;
  onConfirmSave: (data: any) => Promise<void>;
}

export default function ProductModal({
  isOpen,
  isEditing,
  families,
  suppliers,
  initialData,
  onClose,
  onConfirmSave,
}: Props) {
  const [formData, setFormData] = useState({
    sku: "",
    itemName: "",
    familyCode: "",
    supplierId: "",
    supplierName: "",
    weightInGrams: 0,
    purchasingPrice: 0,
    netPrice: 0,
    initialStock: 0,
    active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        sku: initialData?.sku || "",
        itemName: initialData?.itemName || "",
        familyCode: initialData?.familyCode || families[0]?.familyCode || "FAM-001",
        supplierId: initialData?.supplierId || "",
        supplierName: initialData?.supplierName || "",
        weightInGrams: Number(initialData?.weightInGrams) || 0,
        purchasingPrice: Number(initialData?.purchasingPrice) || 0,
        netPrice: Number(initialData?.netPrice) || 0,
        initialStock: Number(initialData?.stock || initialData?.initialStock) || 0,
        active: initialData?.active !== false,
      });
    }
  }, [isOpen, initialData, families]);

  function handleSupplierChange(suppId: string) {
    const supp = suppliers.find((s) => (s.supplierId || s.id) === suppId);
    setFormData((prev) => ({
      ...prev,
      supplierId: suppId,
      supplierName: supp ? supp.supplierName : "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.itemName.trim()) return alert("Nama produk wajib diisi!");
    setLoading(true);
    try {
      await onConfirmSave({
        ...formData,
        itemName: formData.itemName.trim(),
        purchasingPrice: Number(formData.purchasingPrice) || 0,
        netPrice: Number(formData.netPrice) || 0,
        weightInGrams: Number(formData.weightInGrams) || 0,
        initialStock: Number(formData.initialStock) || 0,
        active: Boolean(formData.active),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-rose-100 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-rose-100 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-rose-950">
              {isEditing ? `Edit Produk [${formData.sku}]` : "Tambah Produk Baru"}
            </h3>
            <p className="text-xs text-slate-500">Parameter katalog produk dan integrasi supplier rekanan</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {isEditing && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU Produk</label>
              <input
                type="text"
                disabled
                value={formData.sku}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 font-mono font-bold text-rose-900 select-none outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Produk *</label>
            <input
              type="text"
              required
              placeholder="misal: Khimar Instan Voal Premium"
              value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              className="w-full p-2 border border-rose-200 rounded-lg outline-none focus:border-rose-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Family Produk</label>
              <select
                disabled={isEditing}
                value={formData.familyCode}
                onChange={(e) => setFormData({ ...formData, familyCode: e.target.value })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none bg-white disabled:bg-slate-100"
              >
                {families.map((f) => (
                  <option key={f.id || f.familyCode} value={f.familyCode}>
                    {f.familyCode} - {f.familyName || f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supplier Rekanan</label>
              <select
                value={formData.supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none bg-white font-medium text-rose-950"
              >
                <option value="">-- Pilih Supplier --</option>
                {suppliers.filter((s) => s.active !== false).map((s) => (
                  <option key={s.id || s.supplierId} value={s.supplierId || s.id}>
                    {s.supplierId ? `[${s.supplierId}] ` : ""}{s.supplierName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">HPP (Beli) Rp</label>
              <input
                type="number"
                min="0"
                value={formData.purchasingPrice}
                onChange={(e) => setFormData({ ...formData, purchasingPrice: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Harga Jual Rp</label>
              <input
                type="number"
                min="0"
                value={formData.netPrice}
                onChange={(e) => setFormData({ ...formData, netPrice: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none font-bold text-rose-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Berat (Gram)</label>
              <input
                type="number"
                min="0"
                value={formData.weightInGrams}
                onChange={(e) => setFormData({ ...formData, weightInGrams: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>
          </div>

          {!isEditing && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Stok Awal (Inisialisasi)</label>
              <input
                type="number"
                min="0"
                value={formData.initialStock}
                onChange={(e) => setFormData({ ...formData, initialStock: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none font-bold text-emerald-700"
              />
            </div>
          )}

          {/* STATUS KEAKTIFAN SKU */}
          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 flex items-center justify-between">
            <div>
              <span className="font-bold text-rose-950 block">Status Keaktifan SKU</span>
              <p className="text-[11px] text-slate-500">SKU aktif dapat dipilih pada pemesanan Sales Order</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 accent-[#BE185D] cursor-pointer"
              />
              <span className={formData.active ? "text-emerald-700 font-bold" : "text-red-600 font-bold"}>
                {formData.active ? "AKTIF" : "NONAKTIF"}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white font-bold rounded-xl shadow"
            >
              {loading ? "Menyimpan..." : "Simpan Produk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}