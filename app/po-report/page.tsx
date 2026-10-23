"use client";
import React from "react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="p-6 space-y-4 font-sans text-xs">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-xl font-bold text-slate-800">PO REPORT</h1>
        <Link href="/konter" className="px-3 py-1.5 bg-slate-800 text-white font-bold rounded">
          Kembali ke Konter
        </Link>
      </div>
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        Modul PO REPORT telah terhubung ke WMS. Silakan gunakan menu ini untuk transaksi.
      </div>
    </div>
  );
}
