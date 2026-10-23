"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProductFamily } from "@/lib/types";
import * as XLSX from "xlsx";

export default function KonterFamilyPage() {
  const [families, setFamilies] = useState<KonterProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyName, setFamilyName] = useState("");
  const [familyDesc, setFamilyDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadFamilies();
  }, []);

  async function loadFamilies() {
    setLoading(true);
    try {
      const data = await operationalService.getFamilies();
      setFamilies(data);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data family: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!familyName.trim()) return;

    setSubmitting(true);
    setMsg(null);
    try {
      await operationalService.createFamily(familyName, familyDesc);
      setMsg({ type: "success", text: "Family produk berhasil ditambahkan." });
      setFamilyName("");
      setFamilyDesc("");
      await loadFamilies();
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal menambahkan family: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Fungsi Ekspor Data Family ke File XLSX
  function handleExportXlsx() {
    if (families.length === 0) {
      alert("Tidak ada data family untuk diekspor.");
      return;
    }

    const exportData = families.map((f, index) => ({
      "No": index + 1,
      "Kode Family": f.code,
      "Nama Family": f.name,
      "Deskripsi": f.description || "-",
      "Tanggal Dibuat": f.createdAt ? new Date(f.createdAt).toLocaleDateString("id-ID") : "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Family");

    const colWidths = [{ wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 18 }];
    worksheet["!cols"] = colWidths;

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Data_Family_Konter_${dateStr}.xlsx`);
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pengelolaan Family Produk</h1>
          <p className="text-xs text-slate-500">Katalog pengelompokan family/kategori produk konter &amp; PPOB.</p>
        </div>
        <button
          onClick={handleExportXlsx}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2"
        >
          <span>📥 Ekspor ke XLSX</span>
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Form Tambah Family Baru */}
      <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900">+ Tambah Family Baru</h2>
        <form onSubmit={handleCreateFamily} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block font-semibold mb-1">Nama Family <span className="text-rose-600">*</span></label>
            <input
              type="text"
              required
              placeholder="Contoh: Pulsa & Paket Data"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Deskripsi</label>
            <input
              type="text"
              placeholder="Keterangan singkat..."
              value={familyDesc}
              onChange={(e) => setFamilyDesc(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm transition"
            >
              {submitting ? "Menyimpan..." : "Simpan Family"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Data Family */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-rose-100 font-bold text-slate-900 flex justify-between items-center">
          <span>Daftar Family Terdaftar</span>
          <span className="text-xs text-slate-500 font-normal">Total: {families.length} Family</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">Kode Family</th>
                <th className="p-3">Nama Family</th>
                <th className="p-3">Deskripsi</th>
                <th className="p-3">Tanggal Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400">Memuat data family...</td></tr>
              ) : families.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-400">Belum ada data family produk.</td></tr>
              ) : (
                families.map(f => (
                  <tr key={f.id} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{f.code}</td>
                    <td className="p-3 font-bold">{f.name}</td>
                    <td className="p-3 text-slate-600">{f.description || "-"}</td>
                    <td className="p-3 font-mono text-slate-500">
                      {f.createdAt ? new Date(f.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}