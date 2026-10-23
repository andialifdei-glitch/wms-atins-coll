"use client";

import React, { useState, useEffect } from "react";
import { supplierOperationalService } from "@/lib/operationalService";
import type { KonterSupplier } from "@/lib/types";

export default function KonterSuppliersPage() {
  const [suppliers, setSuppliers] = useState<KonterSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    address: "",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const data = await supplierOperationalService.getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat supplier: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingId(null);
    setFormData({ name: "", contactPerson: "", phone: "", address: "", notes: "" });
    setIsModalOpen(true);
  }

  function handleOpenEdit(s: KonterSupplier) {
    setEditingId(s.id || null);
    setFormData({
      name: s.name,
      contactPerson: s.contactPerson || "",
      phone: s.phone || "",
      address: s.address || "",
      notes: s.notes || ""
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    setMsg(null);
    try {
      await supplierOperationalService.saveSupplier(formData, editingId || undefined);
      setMsg({ type: "success", text: editingId ? "Data supplier berhasil diperbarui." : "Supplier baru berhasil didaftarkan dengan kode SUPP-xxx." });
      setIsModalOpen(false);
      await loadSuppliers();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Hapus supplier [${code}]?`)) return;
    try {
      await (supplierOperationalService as any).deleteSupplier(id);
      setMsg({ type: "success", text: `Supplier ${code} berhasil dihapus.` });
      await loadSuppliers();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
  }

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.supplierCode.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.includes(search))
  );

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kelola Supplier</h1>
          <p className="text-xs text-slate-500">Daftar pemasok/distributor barang dengan penomoran otomatis SUPP-xxx.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-3.5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm transition"
        >
          + Tambah Supplier Baru
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm max-w-md">
        <label className="block text-slate-900 font-semibold mb-1">Cari Supplier</label>
        <input
          type="text"
          placeholder="Cari kode, nama, atau nomor HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-[#BE185D] text-slate-900 bg-white"
        />
      </div>

      {/* Tabel Supplier */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">Kode Supplier</th>
                <th className="p-3">Nama Pemasok</th>
                <th className="p-3">Kontak Person</th>
                <th className="p-3">No. Telepon / HP</th>
                <th className="p-3">Alamat</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Memuat daftar supplier...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Belum ada data supplier terdaftar.</td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{s.supplierCode}</td>
                    <td className="p-3 font-bold text-slate-900">{s.name}</td>
                    <td className="p-3 text-slate-700">{s.contactPerson || "-"}</td>
                    <td className="p-3 font-mono text-slate-700">{s.phone || "-"}</td>
                    <td className="p-3 text-slate-600 truncate max-w-xs">{s.address || "-"}</td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 font-bold rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.id!, s.supplierCode)}
                        className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 font-bold rounded"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-rose-100 w-full max-w-lg p-5 text-slate-900">
            <h2 className="text-sm font-bold text-slate-900 mb-3">{editingId ? "Edit Data Supplier" : "Tambah Supplier Baru (SUPP-xxx)"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-900 font-semibold mb-1">Nama Pemasok / Distributor <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="misal: PT Telekomunikasi Selular / Agen Pulsa Utama"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-900 font-semibold mb-1">Nama Kontak Person</label>
                  <input
                    type="text"
                    placeholder="Nama sales / PIC..."
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-900 font-semibold mb-1">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="08123456789..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-900 font-semibold mb-1">Alamat Kantor / Toko</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap pemasok..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-900 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-900 font-semibold mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Termin pembayaran, catatan khusus..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  {submitting ? "Menyimpan..." : "Simpan Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}