"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { StockMovement } from "@/lib/types";

export default function StockMovementPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    operationalService.getMovements().then((data: any) => {
      setMovements(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-xl font-bold text-slate-800">Stock Movement Audit Trail</h1>
        <p className="text-xs text-slate-500">Histori mutasi keluar-masuk stok dengan transparansi saldo sebelum dan sesudah perubahan.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b font-semibold text-slate-600">
                <th className="p-3">Waktu</th>
                <th className="p-3">Produk / SKU</th>
                <th className="p-3">Tipe Mutasi</th>
                <th className="p-3 text-center">Sebelum</th>
                <th className="p-3 text-center">Perubahan</th>
                <th className="p-3 text-center">Sesudah</th>
                <th className="p-3">Referensi</th>
                <th className="p-3">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">Memuat riwayat mutasi...</td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">Belum ada pergerakan stok.</td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 text-slate-500">{new Date(m.timestamp).toLocaleString("id-ID")}</td>
                    <td className="p-3 font-semibold text-slate-800"><b>{m.productSku}</b> - {m.productName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {m.type}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-500">{m.quantityBefore}</td>
                    <td className={`p-3 text-center font-bold ${m.quantityChange < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">{m.quantityAfter}</td>
                    <td className="p-3 font-mono text-indigo-600 font-semibold">{m.referenceDoc}</td>
                    <td className="p-3 text-slate-600">{m.notes}</td>
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