"use client";
import React, { useState, useEffect } from "react";

interface SupplierModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialData: any;
  onClose: () => void;
  onSave: (formData: any) => void;
}

export default function SupplierModal({
  isOpen,
  isEditing,
  initialData,
  onClose,
  onSave,
}: SupplierModalProps) {
  const [formData, setFormData] = useState<any>({
    supplierName: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        supplierId: initialData.supplierId || "",
        supplierName: initialData.supplierName || "",
        phone: initialData.phone || "",
        address: initialData.address || "",
      });
    } else {
      setFormData({ supplierName: "", phone: "", address: "" });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-rose-100">
        <div className="border-b border-rose-100 pb-3 mb-4">
          <h3 className="text-base font-bold text-rose-950">
            {isEditing ? `Edit Supplier [${formData.supplierId}]` : "Tambah Supplier Baru"}
          </h3>
          <p className="text-xs text-rose-500">
            {isEditing ? "Perbarui informasi supplier rekanan" : "ID supplier otomatis berurutan (SUPP-XXXX)"}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="space-y-3.5 text-xs"
        >
          {isEditing && (
            <div>
              <label className="block font-semibold text-rose-900 mb-1">Kode Supplier</label>
              <input
                type="text"
                disabled
                value={formData.supplierId || ""}
                className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 font-mono font-bold text-slate-600 select-none cursor-not-allowed outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-rose-900 mb-1">Nama Supplier *</label>
            <input
              type="text"
              required
              placeholder="misal: PT Tekstil Bandung Makmur"
              value={formData.supplierName}
              onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
              className="w-full p-2 border border-rose-200 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-rose-900 mb-1">No. Handphone / WhatsApp *</label>
            <input
              type="text"
              required
              placeholder="misal: 081234567890"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-2 border border-rose-200 rounded-lg outline-none font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-rose-900 mb-1">Alamat Supplier *</label>
            <textarea
              rows={3}
              required
              placeholder="Alamat lengkap operasional supplier..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2 border border-rose-200 rounded-lg outline-none"
            />
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
              Simpan Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}