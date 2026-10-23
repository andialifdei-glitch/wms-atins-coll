"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface BCCSidebarProps {
  activeTabWms?: string;
  onSelectWmsTab?: (tab: string) => void;
}

export default function BCCSidebar({ activeTabWms, onSelectWmsTab }: BCCSidebarProps) {
  const pathname = usePathname();

  // Buka dropdown sesuai rute aktif
  const isKonterRoute = pathname?.startsWith("/konter");
  const isWmsRoute = pathname === "/" || pathname === "/dashboard" || pathname?.startsWith("/catalog") || pathname?.startsWith("/reports");

  const [openWms, setOpenWms] = useState<boolean>(!isKonterRoute);
  const [openKonter, setOpenKonter] = useState<boolean>(isKonterRoute);

  const wmsMenus = [
    { id: "dashboard", label: "Dashboard WMS", href: "/?tab=dashboard" },
    { id: "sales", label: "Sales & Delivery Order", href: "/?tab=sales" },
    { id: "inventory", label: "Katalog Persediaan", href: "/?tab=inventory" },
    { id: "purchase", label: "Purchase & Receiving", href: "/?tab=purchase" },
    { id: "reports", label: "Pusat Laporan Historis", href: "/?tab=reports" },
    { id: "settings", label: "Konfigurasi Sistem", href: "/?tab=settings" },
    { id: "human", label: "Manajemen Staf & Relasi", href: "/?tab=human" },
  ];

  const konterMenus = [
    { id: "dashboard", label: "Dashboard Konter", href: "/dashboard" },
    { id: "transaksi", label: "Riwayat Transaksi", href: "/transaksi" },
    { id: "master", label: "Master Data", href: "/master" },
    { id: "keuangan", label: "Keuangan & Saldo", href: "/keuangan" },
    { id: "pengeluaran", label: "Pengeluaran", href: "/pengeluaran" },
    { id: "laporan", label: "Laporan & Analitik", href: "/laporan" },
    { id: "admin", label: "Administrasi & Keamanan", href: "/admin" },
  ];

  return (
    <aside className="w-64 min-h-screen bg-[#1E293B] text-slate-100 border-r border-slate-700 p-4 flex flex-col justify-between shrink-0 shadow-lg select-none">
      <div className="flex flex-col gap-4">
        {/* Brand / Title Header */}
        <div className="px-3 py-2 border-b border-slate-700">
          <div className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Business Control Center</div>
          <div className="text-lg font-bold text-white mt-0.5">Emir Cell & Atin Group</div>
        </div>

        {/* Navigation Group A: Dashboard Utama */}
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/" && !activeTabWms
                ? "bg-indigo-600 text-white font-semibold"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>📊</span>
            <span>Dashboard Utama</span>
          </Link>
        </div>

        {/* Navigation Group B: Dropdown Atin's Collection (WMS) */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setOpenWms(!openWms)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-rose-400">📦</span>
              <span className="font-semibold text-rose-300">Atin&apos;s Collection</span>
            </div>
            <span className={`text-xs text-slate-400 transform transition-transform ${openWms ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {openWms && (
            <div className="mt-1 pl-4 ml-3 border-l-2 border-rose-500/30 flex flex-col gap-1">
              {wmsMenus.map((item) => {
                const isActive = activeTabWms === item.id || (!activeTabWms && item.id === "dashboard" && pathname === "/");
                return onSelectWmsTab ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectWmsTab(item.id)}
                    className={`text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-rose-500/20 text-rose-300 font-bold border-l-2 border-rose-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-rose-500/20 text-rose-300 font-bold border-l-2 border-rose-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation Group C: Dropdown Konter & PPOB */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setOpenKonter(!openKonter)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">⚡</span>
              <span className="font-semibold text-emerald-300">Konter & PPOB</span>
            </div>
            <span className={`text-xs text-slate-400 transform transition-transform ${openKonter ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {openKonter && (
            <div className="mt-1 pl-4 ml-3 border-l-2 border-emerald-500/30 flex flex-col gap-1">
              {konterMenus.map((item) => {
                const isActive = pathname === item.href || (item.id === "dashboard" && pathname === "/konter");
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info / Environment Tag */}
      <div className="pt-3 border-t border-slate-700/80 text-center">
        <div className="text-[11px] text-slate-400">BCC Hybrid Edge Mode</div>
        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Cloudflare Workers Ready</div>
      </div>
    </aside>
  );
}
