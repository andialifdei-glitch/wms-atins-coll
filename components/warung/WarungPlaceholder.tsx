"use client";

import React from "react";

interface Props {
  title: string;
  description?: string;
}

export default function WarungPlaceholder({ title, description }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center">
      <div className="text-4xl mb-3">🏪</div>
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
      <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
        {description || "Modul ini belum diimplementasikan. Implementasi akan dilakukan bertahap sesuai roadmap Operasional Warung."}
      </p>
      <div className="mt-4 inline-block text-[10px] uppercase font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded">
        Coming Soon
      </div>
    </div>
  );
}