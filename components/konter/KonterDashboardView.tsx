"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { operationalService } from "@/lib/operationalService";





const formatTimestamp = (val: any) => toSafeText(val);
function toSafeText(val: any): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val?.toDate === "function") {
    try { return val.toDate().toLocaleString("id-ID"); } catch { return "-"; }
  }
  if (typeof val?.seconds === "number") {
    try { return new Date(val.seconds * 1000).toLocaleString("id-ID"); } catch { return "-"; }
  }
  if (val instanceof Date) {
    return val.toLocaleString("id-ID");
  }
  if (typeof val === "object") {
    if (val.name) return String(val.name);
    if (val.title) return String(val.title);
    return "-";
  }
  return String(val);
}

export default function KonterDashboardView() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "report" | "import">("dashboard");
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter Tanggal Laporan
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // State Import
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    loadSalesData();
  }, [startDate, endDate]);

  async function loadSalesData() {
    setLoading(true);
        try {
      // DIAGNOSTIK KONEKSI FIREBASE
      const inst = operationalService as any;
      console.log("=== FIREBASE DIAGNOSTIK ===");
      console.log("Memanggil koleksi: konter_sales");
      console.log("Firebase App Name:", (window as any)?._debugDb?.app?.name || "Memeriksa...");
      const data = await operationalService.getSales(startDate || undefined, endDate || undefined);
      setSales(((data || []).map((s: any) => ({
    ...s,
    date: toSafeText(s.date || s.createdAt || s.timestamp),
    createdAt: toSafeText(s.createdAt),
    timestamp: toSafeText(s.timestamp),
  }))).map((item: any) => ({
    ...item,
    dateStr: toSafeText(item.date || item.createdAt || item.timestamp)
  })));
    } catch (err: any) {
      console.error("Gagal memuat data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
          try {
      // DIAGNOSTIK KONEKSI FIREBASE
      const inst = operationalService as any;
      console.log("=== FIREBASE DIAGNOSTIK ===");
      console.log("Memanggil koleksi: konter_sales");
      console.log("Firebase App Name:", (window as any)?._debugDb?.app?.name || "Memeriksa...");
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json(ws);
        setPreviewData(parsed.slice(0, 5));
      } catch (e) {
        console.error(e);
      }
    };
    reader.readAsBinaryString(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
          try {
      // DIAGNOSTIK KONEKSI FIREBASE
      const inst = operationalService as any;
      console.log("=== FIREBASE DIAGNOSTIK ===");
      console.log("Memanggil koleksi: konter_sales");
      console.log("Firebase App Name:", (window as any)?._debugDb?.app?.name || "Memeriksa...");
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        const res = await operationalService.importSalesBatch(rawJson);
        setImportResult(res);
        loadSalesData();
      } catch (err: any) {
        setImportResult({ successCount: 0, failedCount: 0, errors: [err.message] });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const totalOmzet = sales.reduce((acc, curr) => acc + (Number(curr.totalOmzet || curr.total) || 0), 0);
  const totalProfit = sales.reduce((acc, curr) => acc + (Number(curr.grossProfit) || 0), 0);
  const totalQty = sales.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      {/* Header Modul */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Modul Operasional Konter</h1>
          <p className="text-slate-500">Integrasi transaksi ritel, import mutasi kasir, dan kalkulasi P&L.</p>


        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-1.5 rounded-lg font-bold transition ${
              activeTab === "dashboard" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`px-4 py-1.5 rounded-lg font-bold transition ${
              activeTab === "report" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Laporan Penjualan
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`px-4 py-1.5 rounded-lg font-bold transition ${
              activeTab === "import" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Import Excel
          </button>
        </div>
      </div>

      {/* 1. TAB DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="block text-slate-500 font-bold mb-1">Total Transaksi</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{sales.length} Trx</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="block text-slate-500 font-bold mb-1">Total Omzet Penjualan</span>
              <span className="text-2xl font-bold font-mono text-slate-900">Rp {totalOmzet.toLocaleString("id-ID")}</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="block text-slate-500 font-bold mb-1">Total Laba Kotor</span>
              <span className="text-2xl font-bold font-mono text-emerald-600">Rp {totalProfit.toLocaleString("id-ID")}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-slate-800">5 Transaksi Terakhir</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-3">No. Trx</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Nama Produk</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Omzet</th>
                    <th className="p-3 text-right">Laba Kotor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.slice(0, 5).map((s: any, idx) => (
                    <tr key={s.id || idx}>
                      <td className="p-3 font-mono font-bold">{s.transactionId || "-"}</td>
                      <td className="p-3">{s.date || "-"}</td>
                      <td className="p-3 font-bold">{s.itemName}</td>
                      <td className="p-3 text-right">{s.qty || 1}</td>
                      <td className="p-3 text-right font-mono">Rp {(s.totalOmzet || s.total || 0).toLocaleString("id-ID")}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">Rp {(s.grossProfit || 0).toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB LAPORAN PENJUALAN */}
      {activeTab === "report" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1.5 border rounded bg-slate-50 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1.5 border rounded bg-slate-50 text-slate-800"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="mt-4 px-2 py-1 text-slate-500 hover:text-rose-600 font-bold underline"
              >
                Reset
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold">
                    <th className="p-3">No. Trx</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Nama Produk</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Omzet</th>
                    <th className="p-3 text-right">Laba Kotor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">Memuat data...</td></tr>
                  ) : sales.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">Tidak ada transaksi ditemukan.</td></tr>
                  ) : (
                    sales.map((s: any, idx) => (
                      <tr key={s.id || idx}>
                        <td className="p-3 font-mono font-bold text-slate-700">{s.transactionId}</td>
                        <td className="p-3">{toSafeText(s.date)}</td>
                        <td className="p-3 font-mono text-rose-600">{s.sku || "-"}</td>
                        <td className="p-3 font-bold">{s.itemName}</td>
                        <td className="p-3 text-right font-mono">{s.qty || 1}</td>
                        <td className="p-3 text-right font-mono">Rp {(s.totalOmzet || s.total || 0).toLocaleString("id-ID")}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">Rp {(s.grossProfit || 0).toLocaleString("id-ID")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB IMPORT SALES */}
      {activeTab === "import" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <label className="block text-slate-700 font-bold">Upload File Rekap Penjualan (.xlsx / .xls)</label>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="w-full p-2 border rounded bg-slate-50 text-slate-800"
            />
            <button
              onClick={handleUpload}
              disabled={importing || !file}
              className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition disabled:opacity-50"
            >
              {importing ? "Memproses Import..." : "Mulai Import Transaksi"}
            </button>
          </div>

          {previewData.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="font-bold text-slate-800">Preview 5 Baris Data Terbaca:</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold">
                      {Object.keys(previewData[0] || {}).map((c, i) => (
                        <th key={i} className="p-2 border border-slate-200">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, r) => (
                      <tr key={r}>
                        {Object.values(row).map((val: any, c) => (
                          <td key={c} className="p-2 border border-slate-200">
                            {val instanceof Date ? val.toISOString().slice(0, 10) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <span className="font-bold text-slate-800">Hasil Import:</span>
              <div className="text-emerald-600 font-bold">Berhasil tersimpan: {importResult.successCount} baris</div>
              {importResult.errors?.length > 0 && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded border border-rose-200 space-y-1">
                  {importResult.errors.map((e: string, i: number) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


