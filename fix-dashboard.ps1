$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = $PWD

Write-Host ">>> Memperbaiki ketergantungan konterDb dan memindahkan Dashboard ke root..." -ForegroundColor Cyan

# 1. Pindahkan app/konter/dashboard ke app/dashboard jika belum dipindah
if (Test-Path "$root\app\konter\dashboard") {
    if (-not (Test-Path "$root\app\dashboard")) {
        New-Item -ItemType Directory -Path "$root\app\dashboard" -Force | Out-Null
    }
    Move-Item -Path "$root\app\konter\dashboard\*" -Destination "$root\app\dashboard\" -Force
    Remove-Item -Path "$root\app\konter\dashboard" -Recurse -Force
    Write-Host "[OK] Halaman dashboard dipindahkan ke app/dashboard" -ForegroundColor Green
}

# Hapus folder app/konter jika sudah kosong
if (Test-Path "$root\app\konter") {
    $remaining = Get-ChildItem -Path "$root\app\konter" -Recurse -File -ErrorAction SilentlyContinue
    if ($remaining.Count -eq 0) {
        Remove-Item -Path "$root\app\konter" -Recurse -Force
        Write-Host "[OK] Folder app/konter dibersihkan" -ForegroundColor Green
    }
}

# 2. Perbarui app/dashboard/page.tsx agar memakai operationalService (bukan konterDb)
$dashboardPath = "$root\app\dashboard\page.tsx"
if (Test-Path $dashboardPath) {
    $dashboardCode = @'
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { operationalService } from "@/lib/operationalService";

export default function DashboardKonterPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const rawSales = await operationalService.getSales();
        setSales(rawSales || []);
      } catch (err) {
        console.error("Gagal memuat data dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalOmzet = sales.reduce((acc, curr) => acc + (Number(curr.totalOmzet || curr.total) || 0), 0);
  const totalProfit = sales.reduce((acc, curr) => acc + (Number(curr.grossProfit) || 0), 0);
  const totalTrx = sales.length;

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard Operasional</h1>
          <p className="text-xs text-slate-500">Ringkasan aktivitas penjualan dan performa transaksi.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/import-sales"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition"
          >
            + Import Penjualan
          </Link>
          <Link
            href="/sales-report"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm transition"
          >
            Lihat Laporan
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm">
          <span className="block text-slate-500 font-bold mb-1">Total Transaksi</span>
          <span className="text-2xl font-bold font-mono text-slate-900">
            {loading ? "..." : `${totalTrx} Trx`}
          </span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm">
          <span className="block text-slate-500 font-bold mb-1">Total Omzet Penjualan</span>
          <span className="text-2xl font-bold font-mono text-slate-900">
            {loading ? "..." : `Rp ${totalOmzet.toLocaleString("id-ID")}`}
          </span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm">
          <span className="block text-slate-500 font-bold mb-1">Total Laba Kotor</span>
          <span className="text-2xl font-bold font-mono text-emerald-600">
            {loading ? "..." : `Rp ${totalProfit.toLocaleString("id-ID")}`}
          </span>
        </div>
      </div>

      {/* 5 Transaksi Terakhir */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-rose-100 font-bold text-slate-800">
          5 Transaksi Terkini
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">No. Trx</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Nama Produk</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Omzet</th>
                <th className="p-3 text-right">Laba Kotor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Memuat transaksi...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">Belum ada transaksi tersimpan.</td>
                </tr>
              ) : (
                sales.slice(0, 5).map((s: any, idx: number) => (
                  <tr key={s.id || idx} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-slate-700">{s.transactionId || "-"}</td>
                    <td className="p-3 font-mono text-slate-600">{s.date || "-"}</td>
                    <td className="p-3 font-bold">{s.itemName || "-"}</td>
                    <td className="p-3 text-right font-mono font-bold">{s.qty || 1}</td>
                    <td className="p-3 text-right font-mono font-bold">
                      Rp {(Number(s.totalOmzet || s.total) || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      Rp {(Number(s.grossProfit) || 0).toLocaleString("id-ID")}
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
