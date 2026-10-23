"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { konterDb } from "@/lib/konterDb";

export default function DashboardKonterPage() {
  const [transaksi, setTransaksi] = useState(konterDb.getTransaksi());
  const [kasList, setKasList] = useState(konterDb.getKas());
  const [providers, setProviders] = useState(konterDb.getProviders());
  const [pelanggan, setPelanggan] = useState(konterDb.getPelanggan());
  const [pengeluaran, setPengeluaran] = useState(konterDb.getPengeluaran());

  const totalOmzet = transaksi.filter(t => t.status === "SUCCESS").reduce((sum: number, t: any) => sum + t.hargaJual, 0);
  const totalLabaKotor = transaksi.filter(t => t.status === "SUCCESS").reduce((sum: number, t: any) => sum + t.laba, 0);
  const totalBiayaOperasional = pengeluaran.reduce((sum: number, p: any) => sum + p.nominal, 0);
  const labaBersih = totalLabaKotor - totalBiayaOperasional;

  const totalKasBank = kasList.reduce((sum: number, k: any) => sum + k.saldo, 0);
  const totalDepositProvider = providers.reduce((sum: number, p: any) => sum + p.saldoTersedia, 0);
  const totalPiutang = pelanggan.reduce((sum: number, c: any) => sum + c.totalPiutang, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard Konter & PPOB</h1>
          <p className="text-sm text-slate-400 mt-1">Ringkasan transaksi real-time, deposit provider, kas konter, dan piutang pelanggan.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/transaksi"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-md transition-all flex items-center gap-2"
          >
            <span>+</span> Transaksi PPOB Baru
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omzet */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Omzet Penjualan</div>
          <div className="text-2xl font-bold text-white mt-2">Rp {totalOmzet.toLocaleString("id-ID")}</div>
          <div className="text-xs text-emerald-400 mt-2 font-medium">Transaksi Sukses: {transaksi.length}</div>
        </div>

        {/* Laba Bersih */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimasi Laba Bersih</div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">Rp {labaBersih.toLocaleString("id-ID")}</div>
          <div className="text-xs text-slate-400 mt-2">Laba Kotor: Rp {totalLabaKotor.toLocaleString("id-ID")}</div>
        </div>

        {/* Kas & Bank */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Kas & Bank</div>
          <div className="text-2xl font-bold text-cyan-400 mt-2">Rp {totalKasBank.toLocaleString("id-ID")}</div>
          <div className="text-xs text-slate-400 mt-2">{kasList.length} Akun Penyimpanan Kas</div>
        </div>

        {/* Deposit Provider */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saldo Deposit Provider</div>
          <div className="text-2xl font-bold text-amber-400 mt-2">Rp {totalDepositProvider.toLocaleString("id-ID")}</div>
          <div className="text-xs text-slate-400 mt-2">{providers.length} Vendor PPOB Aktif</div>
        </div>
      </div>

      {/* Saldo Warning & Piutang Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-rose-400 uppercase">Piutang Pelanggan (Bon)</div>
            <div className="text-xl font-bold text-white mt-1">Rp {totalPiutang.toLocaleString("id-ID")}</div>
          </div>
          <Link href="/keuangan" className="text-xs text-rose-400 underline hover:text-rose-300">
            Detail & Penagihan →
          </Link>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Pengeluaran Operasional</div>
            <div className="text-xl font-bold text-white mt-1">Rp {totalBiayaOperasional.toLocaleString("id-ID")}</div>
          </div>
          <Link href="/pengeluaran" className="text-xs text-indigo-400 underline hover:text-indigo-300">
            Kelola Biaya →
          </Link>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase">Status Integrasi Provider</div>
            <div className="text-sm font-semibold text-emerald-400 mt-1">Siap Eksekusi Transaksi</div>
          </div>
          <Link href="/master" className="text-xs text-emerald-400 underline hover:text-emerald-300">
            Cek Provider →
          </Link>
        </div>
      </div>

      {/* Transaksi Terkini Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">5 Transaksi Terakhir</h2>
          <Link href="/transaksi" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
            Lihat Semua Transaksi →
          </Link>
        </div>

        {transaksi.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            Belum ada transaksi tercatat. Mulai catat transaksi penjualan pulsa/PPOB melalui tombol di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">No. Tujuan</th>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Harga Jual</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {transaksi.slice(0, 5).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-750">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{t.nomorTransaksi}</td>
                    <td className="px-4 py-3 font-medium text-white">{t.namaProduk}</td>
                    <td className="px-4 py-3 font-mono text-xs text-cyan-300">{t.noTujuan}</td>
                    <td className="px-4 py-3">{t.namaPelanggan}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">Rp {t.hargaJual.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-[11px] rounded bg-slate-700 text-slate-300 font-medium">
                        {t.metodePembayaran}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-[11px] rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
