"use client";

import React, { useState } from "react";
import { konterDb } from "@/lib/konterDb";

export default function LaporanPage() {
  const transaksi = konterDb.getTransaksi();
  const pengeluaran = konterDb.getPengeluaran();
  const [filterKategori, setFilterKategori] = useState<string>("ALL");

  const filteredTrx = transaksi.filter((t) => {
    if (filterKategori !== "ALL" && t.kategori !== filterKategori) return false;
    return true;
  });

  const totalOmzet = filteredTrx.reduce((sum: number, t: any) => sum + t.hargaJual, 0);
  const totalModal = filteredTrx.reduce((sum: number, t: any) => sum + t.hargaBeli, 0);
  const labaKotor = totalOmzet - totalModal;
  const totalBiaya = pengeluaran.reduce((sum: number, p: any) => sum + p.nominal, 0);
  const labaBersih = labaKotor - totalBiaya;

  const downloadCsv = () => {
    let csv = "Nomor Transaksi,Tanggal,Produk,Kategori,Nomor Tujuan,Pelanggan,Modal,Harga Jual,Laba,Metode,Status\n";
    filteredTrx.forEach((t) => {
      csv += `"${t.nomorTransaksi}","${t.tanggal}","${t.namaProduk}","${t.kategori}","${t.noTujuan}","${t.namaPelanggan}",${t.hargaBeli},${t.hargaJual},${t.laba},"${t.metodePembayaran}","${t.status}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Laporan_Konter_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Laporan Keuangan & Analitik</h1>
          <p className="text-sm text-slate-400 mt-1">Laporan omzet, laba kotor, biaya operasional, dan laba bersih usaha.</p>
        </div>
        <button
          onClick={downloadCsv}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-md transition-all flex items-center gap-2"
        >
          <span>📥</span> Ekspor Laporan CSV (Excel)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Omzet Penjualan</div>
          <div className="text-2xl font-bold text-white mt-1">Rp {totalOmzet.toLocaleString("id-ID")}</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Total Modal (HPP)</div>
          <div className="text-2xl font-bold text-slate-300 mt-1">Rp {totalModal.toLocaleString("id-ID")}</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Biaya Operasional</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">Rp {totalBiaya.toLocaleString("id-ID")}</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Laba Bersih Akhir</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">Rp {labaBersih.toLocaleString("id-ID")}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 font-medium">Filter Kategori Produk:</label>
        <select
          value={filterKategori}
          onChange={(e) => setFilterKategori(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
        >
          <option value="ALL">Semua Kategori</option>
          <option value="PULSA">PULSA</option>
          <option value="PAKET_DATA">PAKET DATA</option>
          <option value="TOKEN_PLN">TOKEN PLN</option>
          <option value="E_WALLET">E-WALLET</option>
          <option value="LAINNYA">LAINNYA / FISIK</option>
        </select>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-white mb-4">Rincian Data Transaksi Terkait ({filteredTrx.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">No. Transaksi</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Modal</th>
                <th className="px-4 py-3">Harga Jual</th>
                <th className="px-4 py-3">Laba</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredTrx.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Tidak ada transaksi dalam filter ini.
                  </td>
                </tr>
              ) : (
                filteredTrx.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-750">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{t.nomorTransaksi}</td>
                    <td className="px-4 py-3 font-medium text-white">{t.namaProduk}</td>
                    <td className="px-4 py-3">{t.namaPelanggan}</td>
                    <td className="px-4 py-3 text-slate-400">Rp {t.hargaBeli.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">Rp {t.hargaJual.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-cyan-400 font-bold">+Rp {t.laba.toLocaleString("id-ID")}</td>
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
