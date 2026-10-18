"use client";

import React, { useState, useEffect } from "react";

interface Props {
  isOpen: boolean;
  isEditing: boolean;
  initialData?: any;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export default function SupplierModal({
  isOpen,
  isEditing,
  initialData,
  onClose,
  onSave,
}: Props) {
  const [formData, setFormData] = useState({
    supplierName: "",
    phone: "",
    address: "",
    contactPerson: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        setFormData({
          supplierName: initialData.supplierName || "",
          phone: initialData.phone || "",
          address: initialData.address || "",
          contactPerson: initialData.contactPerson || "",
        });
      } else {
        setFormData({
          supplierName: "",
          phone: "",
          address: "",
          contactPerson: "",
        });
      }
    }
  }, [isOpen, isEditing, initialData]);

  const handleCloseAndReset = () => {
    setFormData({
      supplierName: "",
      phone: "",
      address: "",
      contactPerson: "",
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        supplierName: formData.supplierName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        contactPerson: formData.contactPerson.trim(),
      });
      handleCloseAndReset();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl border border-slate-200 text-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            {isEditing ? `Edit Supplier [${initialData?.supplierId || ""}]` : "Tambah Supplier Rekanan Baru"}
          </h3>
          <button
            type="button"
            onClick={handleCloseAndReset}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold mb-1 text-slate-700">Nama Supplier *</label>
            <input
              type="text"
              required
              placeholder="misal: PT Tekstil Bandung Maju"
              value={formData.supplierName}
              onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">No. Telepon / WA *</label>
            <input
              type="text"
              required
              placeholder="08xxxxxxxxxx"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">PIC / Kontak Personal</label>
            <input
              type="text"
              placeholder="Nama Penanggung Jawab"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Alamat Kantor / Gudang</label>
            <textarea
              rows={2}
              placeholder="Alamat lengkap supplier..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseAndReset}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-300 text-white font-semibold rounded-lg shadow-xs"
            >
              {loading ? "Menyimpan..." : "Simpan Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}