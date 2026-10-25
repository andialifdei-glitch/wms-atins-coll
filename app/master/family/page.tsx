"use client";

import React, { useState, useEffect, useMemo } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProductFamily } from "@/lib/types";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, konterFirestore } from "@/lib/firebase";
import * as XLSX from "xlsx";

export default function KonterFamilyPage() {
  const [families, setFamilies] = useState<KonterProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State Form Tambah
  const [familyCode, setFamilyCode] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [familyDesc, setFamilyDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // State Search Box
  const [searchQuery, setSearchQuery] = useState("");

  // State Modal Edit
  const [editItem, setEditItem] = useState<KonterProductFamily | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [updating, setUpdating] = useState(false);

  // State Notifikasi
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadFamilies();
  }, []);

  // Hitung Kode Otomatis Berikutnya (Contoh: FAM-001, FAM-002)
  function generateNextCode(list: KonterProductFamily[]) {
    let maxNum = 0;
    list.forEach((f) => {
      const match = (f.code || "").match(/(?:FAM-?|FM-?)(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return `FAM-${String(nextNum).padStart(3, "0")}`;
  }

  async function loadFamilies() {
    setLoading(true);
    try {
      const data = await operationalService.getFamilies();
      setFamilies(data);
      // Generate kode otomatis untuk form input baru
      setFamilyCode(generateNextCode(data));
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data family: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  // Tambah Family Baru
  async function handleCreateFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!familyName.trim()) return;

    setSubmitting(true);
    setMsg(null);
    try {
      // Prioritaskan operationalService jika mendukung kode, atau fallback
      if ((operationalService as any).createFamilyWithCode) {
        await (operationalService as any).createFamilyWithCode(familyCode, familyName, familyDesc);
      } else {
        await operationalService.createFamily(familyName, familyDesc);
      }

      setMsg({ type: "success", text: `Family produk "${familyName}" berhasil ditambahkan.` });
      setFamilyName("");
      setFamilyDesc("");
      await loadFamilies();
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal menambahkan family: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Buka Modal Edit
  function handleOpenEdit(item: KonterProductFamily) {
    setEditItem(item);
    setEditCode(item.code || "");
    setEditName(item.name || "");
    setEditDesc(item.description || "");
  }

  // Simpan Perubahan Edit
  async function handleUpdateFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem || !editName.trim()) return;

    setUpdating(true);
    setMsg(null);

    try {
      // 1. Coba lewat operationalService jika ada method update
      if (typeof (operationalService as any).updateFamily === "function") {
        await (operationalService as any).updateFamily(editItem.id, {
          code: editCode,
          name: editName,
          description: editDesc,
        });
      } else {
        // 2. Direct client Firestore update fallback
        const targetDb = konterFirestore || db;
        const ref = doc(targetDb, "konter_families", editItem.id);
        await updateDoc(ref, {
          code: editCode,
          name: editName,
          description: editDesc,
          updatedAt: new Date().toISOString(),
        });
      }

      setMsg({ type: "success", text: `Family "${editName}" berhasil diperbarui.` });
      setEditItem(null);
      await loadFamilies();
    } catch (err: any) {
      console.error("Update error:", err);
      setMsg({ type: "error", text: "Gagal memperbarui family: " + (err.message || err) });
    } finally {
      setUpdating(false);
    }
  }

  // Hapus Family
  async function handleDeleteFamily(id: string, name: string) {
    if (!window.confirm(`Yakin ingin menghapus family "${name}"?`)) return;

    try {
      if (typeof (operationalService as any).deleteFamily === "function") {
        await (operationalService as any).deleteFamily(id);
      } else {
        const targetDb = konterFirestore || db;
        await deleteDoc(doc(targetDb, "konter_families", id));
      }
      setMsg({ type: "success", text: `Family "${name}" berhasil dihapus.` });
      await loadFamilies();
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal menghapus family: " + err.message });
    }
  }

  // Filter Data Real-time via Search Box
  const filteredFamilies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return families;
    return families.filter(
      (f) =>
        (f.code || "").toLowerCase().includes(q) ||
        (f.name || "").toLowerCase().includes(q) ||
        (f.description || "").toLowerCase().includes(q)
    );
  }, [families, searchQuery]);

  // Ekspor Data Family ke File XLSX
  function handleExportXlsx() {
    if (filteredFamilies.length === 0) {
      alert("Tidak ada data family untuk diekspor.");
      return;
    }

    const exportData = filteredFamilies.map((f, index) => ({
      No: index + 1,
      "Kode Family": f.code,
      "Nama Family": f.name,
      Deskripsi: f.description || "-",
      "Tanggal Dibuat": f.createdAt ? new Date(f.createdAt).toLocaleDateString("id-ID") : "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Family");

    worksheet["!cols"] = [{ wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 18 }];

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Data_Family_Konter_${dateStr}.xlsx`);
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pengelolaan Family Produk</h1>
          <p className="text-xs text-slate-500">Katalog pengelompokan family/kategori produk konter &amp; PPOB.</p>
        </div>
        <button
          onClick={handleExportXlsx}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-2 self-start md:self-auto"
        >
          <span> Ekspor ke XLSX</span>
        </button>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg flex justify-between items-center ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="font-bold ml-4 text-slate-400 hover:text-slate-600">
            
          </button>
        </div>
      )}

      {/* Form Tambah Family Baru dengan Auto-Code */}
      <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900">+ Tambah Family Baru</h2>
        <form onSubmit={handleCreateFamily} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block font-semibold mb-1">
              Kode Family <span className="text-slate-400 font-normal">(Otomatis)</span>
            </label>
            <input
              type="text"
              readOnly
              value={familyCode}
              placeholder="FAM-001"
              className="w-full p-2 border rounded-lg bg-slate-100 text-[#BE185D] font-mono font-bold cursor-not-allowed outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              Nama Family <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Pulsa & Paket Data"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white outline-none focus:border-[#BE185D]"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Deskripsi</label>
            <input
              type="text"
              placeholder="Keterangan singkat..."
              value={familyDesc}
              onChange={(e) => setFamilyDesc(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white outline-none focus:border-[#BE185D]"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm transition"
            >
              {submitting ? "Menyimpan..." : "Simpan Family"}
            </button>
          </div>
        </form>
      </div>

      {/* Search Box & Data Table */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 border-b border-rose-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">Daftar Family Terdaftar</span>
            <span className="text-xs bg-rose-50 text-[#BE185D] px-2 py-0.5 rounded-full font-bold">
              Total: {filteredFamilies.length}
            </span>
          </div>

          {/* Kolom Pencarian Cepat */}
          <div className="w-full md:w-72 relative">
            <input
              type="text"
              placeholder=" Cari kode, nama, atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-2 border rounded-lg outline-none focus:border-[#BE185D] bg-white text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 font-bold"
              >
                
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3 w-32">Kode Family</th>
                <th className="p-3">Nama Family</th>
                <th className="p-3">Deskripsi</th>
                <th className="p-3 w-40">Tanggal Dibuat</th>
                <th className="p-3 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Memuat data family...
                  </td>
                </tr>
              ) : filteredFamilies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    {searchQuery
                      ? `Tidak ditemukan family dengan kata kunci "${searchQuery}".`
                      : "Belum ada data family produk."}
                  </td>
                </tr>
              ) : (
                filteredFamilies.map((f) => (
                  <tr key={f.id} className="hover:bg-rose-50/20 transition">
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{f.code}</td>
                    <td className="p-3 font-bold">{f.name}</td>
                    <td className="p-3 text-slate-600">{f.description || "-"}</td>
                    <td className="p-3 font-mono text-slate-500">
                      {f.createdAt
                        ? new Date(f.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })
                        : "-"}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(f)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded border border-amber-200 transition"
                        >
                           Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFamily(f.id, f.name)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded border border-red-200 transition"
                        >
                          
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Family */}
      {editItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex justify-between items-center border-b border-rose-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900"> Edit Family Produk</h3>
              <button
                onClick={() => setEditItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base"
              >
                
              </button>
            </div>

            <form onSubmit={handleUpdateFamily} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Kode Family</label>
                <input
                    type="text"
                    readOnly
                    disabled
                    value={editCode}
                    className="w-full p-2 border rounded-lg font-mono font-bold bg-slate-100 text-slate-500 cursor-not-allowed outline-none"
                  />
              </div>

              <div>
                <label className="block font-semibold mb-1">Nama Family</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white outline-none focus:border-[#BE185D]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Deskripsi</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Keterangan..."
                  className="w-full p-2 border rounded-lg bg-white outline-none focus:border-[#BE185D]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="px-4 py-2 border rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm transition"
                >
                  {updating ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}