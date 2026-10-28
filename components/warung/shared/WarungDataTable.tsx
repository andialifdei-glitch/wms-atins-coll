"use client";

import React from "react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
}

export default function WarungDataTable<T>({ columns, data, loading, emptyMessage, rowKey }: Props<T>) {
  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">Memuat data...</div>
    );
  }
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-amber-50 text-amber-900 font-bold border-b border-amber-200">
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={`p-2.5 ${c.className || ""}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.map((row) => (
          <tr key={rowKey(row)} className="hover:bg-slate-50">
            {columns.map((c) => (
              <td key={c.key} className={`p-2.5 ${c.className || ""}`}>
                {c.render ? c.render(row) : String((row as any)[c.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
        {data.length === 0 && (
          <tr><td colSpan={columns.length} className="p-6 text-center text-slate-400">{emptyMessage || "Belum ada data."}</td></tr>
        )}
      </tbody>
    </table>
  );
}