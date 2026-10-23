"use client";

import React, { useState } from "react";
import { konterDb } from "@/lib/konterDb";
import { ProdukKonter, TransaksiKonter } from "@/lib/types";

export default function TransaksiPage() {
  const [transaksiList, setTransaksiList] = useState<TransaksiKonter[]>(konterDb.getTransaksi());
  const [produkList] = useState<ProdukKonter[]>(konterDb.getProduk());
  const [pelangganList] = useState(konterDb.getPelanggan());
  const [kasList] = useState(konterDb.getKas());

  const [selectedProdukId, setSelectedProdukId] = useState(produkList[0]?.id || "");
  const [noTujuan, setNoTujuan] = useState("");
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [pelangganId, setPelangganId] = useState("");
  const [metodePembayaran, setMetodePembayaran] = useState<"CASH" | "TRANSFER" | "PIUTANG" | "QRIS">("CASH");
  const [selectedKasId, setSelectedKasId] = useState(kasList[0]?.id || "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");

  const produkTerpilih = produkList.find((p) => p.id === selectedProdukId);

  const handleTransaksi = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!noTujuan.trim()) {
      setErrorMessage("Nomor tujuan/meteran wajib diisi.");
      return;
    }

    try {
      const baru = konterDb.createTransaksi({
        produkId: selectedProdukId,
        noTujuan: noTujuan.trim(),
        namaPelanggan: namaPelanggan.trim() || "Pelanggan Umum",
        pelangganId: pelangganId || undefined,
        metodePembayaran,
        kasId: metodePembayaran !== "PIUTANG" ? selectedKasId : undefined,
      });

      setTransaksiList(konterDb.getTransaksi());
      setSuccessMessage(`Transaksi berhasil diproses! No: ${baru.nomorTransaksi}`);
      setNoTujuan("");
      setNamaPelanggan("");
      setPelangganId("");
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses transaksi");
    }
  };

  const filteredTransaksi = transaksiList.filter(
    (t) =>
      (t.nomorTransaksi || "").toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (t.noTujuan || "").includes(searchKeyword) ||
      (t.namaProduk || "").toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (t.namaPelanggan || "").toLowerCase().includes(searchKeyword.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Kasir & Riwayat Transaksi PPOB</h1>
        <p className="text-sm text-slate-400 mt-1">Pencatatan langsung penjualan pulsa, paket data, token PLN, e-wallet, dan barang fisik.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-white mb-4">Input Penjualan / Transaksi</h2>

          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleTransaksi} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Pilih Produk / Layanan</label>
                <select
                  value={selectedProdukId}
                  onChange={(e) => setSelectedProdukId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {produkList.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.kategori}] {p.namaProduk} - Rp {p.hargaJual.toLocaleString("id-ID")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nomor Tujuan / No Meter PLN</label>
                <input
                  type="text"
                  placeholder="0812xxx atau 1428xxx"
                  value={noTujuan}
                  onChange={(e) => setNoTujuan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nama Pelanggan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Pak RT / Bu Siti"
                  value={namaPelanggan}
                  onChange={(e) => setNamaPelanggan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Pilih Pelanggan Terdaftar</label>
                <select
                  value={pelangganId}
                  onChange={(e) => {
                    setPelangganId(e.target.value);
                    const pel = pelangganList.find((x) => x.id === e.target.value);
                    if (pel) setNamaPelanggan(pel.nama);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Pelanggan Umum --</option>
                  {pelangganList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama} ({c.noHp}) - Piutang: Rp {(c.totalPiutang ?? 0).toLocaleString("id-ID")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Metode Pembayaran</label>
                <select
                  value={metodePembayaran}
                  onChange={(e) => setMetodePembayaran(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CASH">Tunai (Cash Kasir)</option>
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="QRIS">QRIS Merchant</option>
                  <option value="PIUTANG">Hutang / Piutang Pelanggan (Bon)</option>
                </select>
              </div>

              {metodePembayaran !== "PIUTANG" && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Masuk ke Kas / Rekening</label>
                  <select
                    value={selectedKasId}
                    onChange={(e) => setSelectedKasId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {kasList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.namaAkun || k.nama} (Saldo: Rp {k.saldo.toLocaleString("id-ID")})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>⚡</span> Proses Transaksi Sekarang
            </button>
          </form>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-3">Ringkasan Tagihan</h2>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex justify-between pb-2 border-b border-slate-700">
                <span className="text-slate-400">Produk</span>
                <span className="font-medium text-white">{produkTerpilih?.namaProduk || "-"}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-700">
                <span className="text-slate-400">Harga Modal</span>
                <span className="font-medium">Rp {produkTerpilih?.hargaBeli.toLocaleString("id-ID") || 0}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-700">
                <span className="text-slate-400">Harga Jual Konsumen</span>
                <span className="font-bold text-emerald-400 text-lg">
                  Rp {produkTerpilih?.hargaJual.toLocaleString("id-ID") || 0}
                </span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-700">
                <span className="text-slate-400">Estimasi Laba Transaksi</span>
                <span className="font-semibold text-cyan-400">
                  Rp {((produkTerpilih?.hargaJual || 0) - (produkTerpilih?.hargaBeli || 0)).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tipe Produk</span>
                <span className="px-2 py-0.5 text-xs bg-slate-700 rounded text-slate-200">
                  {produkTerpilih?.tipe || "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 text-center text-xs text-slate-400">
            Transaksi otomatis memotong deposit provider terkait secara atomik.
          </div>
        </div>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-base font-semibold text-white">Daftar Transaksi</h2>
          <input
            type="text"
            placeholder="Cari transaksi, no HP, atau pelanggan..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 w-full md:w-72"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">No. Transaksi</th>
                <th className="px-4 py-3">Layanan</th>
                <th className="px-4 py-3">No. Tujuan</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Harga Jual</th>
                <th className="px-4 py-3">Laba</th>
                <th className="px-4 py-3">SN / Referensi</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredTransaksi.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Tidak ada transaksi yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredTransaksi.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-750">
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(t.tanggal || Date.now()).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{t.nomorTransaksi}</td>
                    <td className="px-4 py-3 font-medium text-white">{t.namaProduk}</td>
                    <td className="px-4 py-3 font-mono text-xs text-cyan-300">{t.noTujuan}</td>
                    <td className="px-4 py-3">{t.namaPelanggan}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">Rp {t.hargaJual.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-xs text-cyan-400 font-medium">+Rp {t.laba.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{t.snProvider || "-"}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
