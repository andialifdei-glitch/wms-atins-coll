"use client";

import React, { useState } from "react";
import { konterDb } from "@/lib/konterDb";

export default function PengeluaranPage() {
  const [pengeluaranList, setPengeluaranList] = useState(konterDb.getPengeluaran());
  const [kasList] = useState(konterDb.getKas());

  const [kategori, setKategori] = useState<any>("LISTRIK_INTERNET");
  const [nominal, setNominal] = useState(50000);
  const [sumberKasId, setSumberKasId] = useState(kasList[0]?.id || "");
  const [keterangan, setKeterangan] = useState("");

  const handleTambah = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keterangan || nominal <= 0) return;

    konterDb.tambahPengeluaran({
      tanggal: new Date().toISOString(),
      kategori,
      nominal: Number(nominal),
      sumberKasId,
      keterangan,
      dicatatOleh: "Kasir Konter",
    });

    setPengeluaranList(konterDb.getPengeluaran());
    setKeterangan("");
    setNominal(0);
  };

  const totalPengeluaran = pengeluaranList.reduce((sum: number, p: any) => sum + p.nominal, 0);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Pencatatan Pengeluaran Konter</h1>
        <p className="text-sm text-slate-400 mt-1">Kelola biaya operasional harian, listrik, wifi, sewa, dan pengeluaran lain.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-white mb-4">Catat Pengeluaran Baru</h2>
          <form onSubmit={handleTambah} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Kategori Biaya</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="LISTRIK_INTERNET">Listrik & Internet</option>
                <option value="SEWA_TEMPAT">Sewa Tempat / Kios</option>
                <option value="GAJI_KARYAWAN">Gaji / Insentif Karyawan</option>
                <option value="KONSUMSI">Konsumsi & Operasional Harian</option>
                <option value="PERLENGKAPAN">Perlengkapan & Alat Tulis</option>
                <option value="LAINNYA">Lain-lain</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nominal (Rp)</label>
              <input
                type="number"
                value={nominal}
                onChange={(e) => setNominal(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold text-rose-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Potong dari Kas</label>
              <select
                value={sumberKasId}
                onChange={(e) => setSumberKasId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {kasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {(k.namaAkun || k.nama)} (Sisa: Rp {k.saldo.toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Keterangan Pengeluaran</label>
              <input
                type="text"
                placeholder="Contoh: Beli token listrik konter 50rb"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-sm shadow-md"
            >
              Simpan Pengeluaran
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Riwayat Pengeluaran</h2>
              <div className="text-sm font-semibold text-rose-400">
                Total: Rp {totalPengeluaran.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="px-4 py-3">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {pengeluaranList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                        Belum ada catatan pengeluaran operasional.
                      </td>
                    </tr>
                  ) : (
                    pengeluaranList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-750">
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(p.tanggal).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">{p.kategori}</td>
                        <td className="px-4 py-3 font-medium text-white">{p.keterangan}</td>
                        <td className="px-4 py-3 font-bold text-rose-400">
                          -Rp {p.nominal.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
