"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { operationalService } from "@/lib/operationalService";

export default function KonterImportSalesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [operatorName, setOperatorName] = useState("Admin Konter");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const parsedJson = XLSX.utils.sheet_to_json(ws);
        setPreviewData(parsedJson.slice(0, 5));
      } catch (err) {
        console.error("Gagal membaca preview Excel:", err);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Silakan pilih file Excel terlebih dahulu.");
      return;
    }

    setLoading(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawJson || rawJson.length === 0) {
          alert("File Excel kosong atau tidak memiliki data yang valid.");
          setLoading(false);
          return;
        }

        const res = await operationalService.importSalesBatch(rawJson, operatorName);
        setImportResult(res);
      } catch (err: any) {
        console.error("Kesalahan import sales:", err);
        setImportResult({
          successCount: 0,
          failedCount: 0,
          errors: [`Terjadi kesalahan sistem saat batch import: ${err.message || err}`]
        });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-xs font-sans">
      <div className="border-b border-rose-100 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Import Penjualan Harian</h1>
        <p className="text-xs text-slate-500">Unggah file Excel rekap penjualan (.xlsx / .xls / .csv) untuk diproses ke Firestore.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-rose-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Nama Operator / Kasir</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="w-full p-2 border rounded font-medium bg-slate-50 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Pilih File Excel Penjualan</label>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="w-full p-1.5 border rounded bg-slate-50 text-slate-800"
            />
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={loading || !file}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition disabled:opacity-50"
        >
          {loading ? "Memproses Batch Import..." : "Mulai Import Data Penjualan"}
        </button>
      </div>

      {/* Preview 5 Baris Pertama */}
      {previewData.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm space-y-2">
          <h2 className="font-bold text-slate-800">Preview 5 Baris Data Terbaca:</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold">
                  {Object.keys(previewData[0] || {}).map((col, idx) => (
                    <th key={idx} className="p-2 border border-slate-200">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 text-slate-700">
                    {Object.values(row).map((val: any, cIdx) => (
                      <td key={cIdx} className="p-2 border border-slate-200">{val instanceof Date ? val.toISOString().slice(0, 10) : String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hasil Import */}
      {importResult && (
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm space-y-3">
          <h2 className="font-bold text-slate-800">Hasil Proses Import:</h2>
          <div className="flex gap-4">
            <span className="text-emerald-700 font-bold">Berhasil: {importResult.successCount} baris</span>
            <span className="text-rose-700 font-bold">Gagal: {importResult.failedCount} baris</span>
          </div>

          {(importResult.errors?.length ?? 0) > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 max-h-48 overflow-y-auto space-y-1">
              {importResult.errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}