"use client";

import React, { useState } from "react";
import { konterDb } from "@/lib/konterDb";

export default function KeuanganPage() {
  const [kasList, setKasList] = useState(konterDb.getKas());
  const [providers, setProviders] = useState(konterDb.getProviders());
  const [pelanggan, setPelanggan] = useState(konterDb.getPelanggan());

  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.id || "");
  const [nominalDeposit, setNominalDeposit] = useState(500000);
  const [sumberKasId, setSumberKasId] = useState(kasList[0]?.id || "");
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  const [selectedPelangganId, setSelectedPelangganId] = useState("");
  const [nominalBayarPiutang, setNominalBayarPiutang] = useState(0);

  const handleDepositProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (nominalDeposit <= 0) return;

    try {
      konterDb.adjustKas(sumberKasId, -nominalDeposit);
      konterDb.updateSaldoProvider(selectedProviderId, nominalDeposit, "Top up saldo deposit dari kas konter");

      setKasList(konterDb.getKas());
      setProviders(konterDb.getProviders());
      setPesanSukses("Deposit provider berhasil ditambahkan dan kas telah disesuaikan!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBayarPiutang = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPelangganId || nominalBayarPiutang <= 0) return;

    konterDb.adjustPiutang(selectedPelangganId, -nominalBayarPiutang);
    konterDb.adjustKas(sumberKasId, nominalBayarPiutang);

    setPelanggan(konterDb.getPelanggan());
    setKasList(konterDb.getKas());
    setPesanSukses("Pembayaran piutang berhasil dicatat ke dalam kas!");
    setNominalBayarPiutang(0);
    setSelectedPelangganId("");
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Keuangan, Saldo & Piutang</h1>
        <p className="text-sm text-slate-400 mt-1">Pengawasan kas laci, rekening bank, deposit server PPOB, dan pelunasan piutang pelanggan.</p>
      </div>

      {pesanSukses && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm">
          {pesanSukses}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kasList.map((k) => (
          <div key={k.id} className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{(k.namaAkun || k.nama)}</div>
            <div className="text-2xl font-bold text-white mt-2">Rp {k.saldo.toLocaleString("id-ID")}</div>
            <div className="text-xs text-cyan-400 mt-1 font-mono">{k.tipe}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-white mb-3">Top Up / Rekonsiliasi Saldo Provider</h2>
          <form onSubmit={handleDepositProvider} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Pilih Provider</label>
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} (Saldo: Rp {p.saldoTersedia.toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Sumber Dana Kas/Bank</label>
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
              <label className="block text-xs font-medium text-slate-300 mb-1">Nominal Tambah Saldo (Rp)</label>
              <input
                type="number"
                value={nominalDeposit}
                onChange={(e) => setNominalDeposit(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold text-emerald-400"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm shadow-md"
            >
              Simpan Penambahan Saldo
            </button>
          </form>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-white mb-3">Pencatatan Bayar Piutang / Bon</h2>
          <form onSubmit={handleBayarPiutang} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Pilih Pelanggan</label>
              <select
                value={selectedPelangganId}
                onChange={(e) => {
                  setSelectedPelangganId(e.target.value);
                  const p = pelanggan.find((x) => x.id === e.target.value);
                  if (p) setNominalBayarPiutang(p.totalPiutang);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">-- Pilih Pelanggan --</option>
                {pelanggan
                  .filter((c) => c.totalPiutang > 0)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama} (Hutang: Rp {c.totalPiutang.toLocaleString("id-ID")})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nominal Pembayaran Diterima (Rp)</label>
              <input
                type="number"
                value={nominalBayarPiutang}
                onChange={(e) => setNominalBayarPiutang(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-semibold text-cyan-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!selectedPelangganId}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold rounded-lg text-sm shadow-md"
            >
              Catat Pelunasan Masuk ke Kas
            </button>
          </form>
        </div>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-semibold text-white mb-4">Daftar Piutang Pelanggan Aktif</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Nama Pelanggan</th>
                <th className="px-4 py-3">No. WhatsApp / HP</th>
                <th className="px-4 py-3">Catatan</th>
                <th className="px-4 py-3">Sisa Piutang</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {pelanggan.map((c) => (
                <tr key={c.id} className="hover:bg-slate-750">
                  <td className="px-4 py-3 font-medium text-white">{c.nama}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">{c.noHp}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{c.catatan || "-"}</td>
                  <td className="px-4 py-3 font-bold text-rose-400">Rp {c.totalPiutang.toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-[11px] rounded font-medium ${
                        c.totalPiutang > 0
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {c.totalPiutang > 0 ? "Belum Lunas" : "Lunas"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
