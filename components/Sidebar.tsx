"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  onLogout?: () => void;
  userRole?: string;
}

export function Sidebar({ activeTab = "dashboard", setActiveTab, onLogout, userRole }: SidebarProps) {
  const pathname = usePathname();

  const [openWms, setOpenWms] = useState<boolean>(true);
  const [openKonter, setOpenKonter] = useState<boolean>(true);
  const [openWarung, setOpenWarung] = useState<boolean>(true);
  const [openPortal, setOpenPortal] = useState<boolean>(false);

  const wmsMenus = [
    { id: "dashboard", label: "Dashboard WMS", href: "/?tab=dashboard", icon: "📊" },
    { id: "sales", label: "Sales & Delivery Order", href: "/?tab=sales", icon: "📦" },
    { id: "inventory", label: "Katalog Persediaan", href: "/?tab=inventory", icon: "🏷️" },
    { id: "purchase", label: "Purchase & Receiving", href: "/?tab=purchase", icon: "📥" },
    { id: "reports", label: "Pusat Laporan Historis", href: "/?tab=reports", icon: "📑" },
    { id: "settings", label: "Konfigurasi Sistem", href: "/?tab=settings", icon: "⚙️" },
  ];

  const konterMenus = [
    { id: "konter-dash", label: "Dashboard Konter", href: "/konter", icon: "📈" },
    { id: "master", label: "Pengelolaan Stock", href: "/master", icon: "📦" },
    { id: "movement", label: "Stock Movement Log", href: "/movement", icon: "🔄" },
    { id: "adjustment", label: "Stock Adjustment", href: "/adjustment", icon: "⚖️" },
    { id: "stock-opname", label: "Stock Opname (SOP)", href: "/stock-opname", icon: "📋" },
    { id: "po", label: "Purchase Order (PO)", href: "/po", icon: "📝" },
    { id: "receiving", label: "Penerimaan (Receiving)", href: "/receiving", icon: "📥" },
    { id: "sales-report", label: "Laporan Penjualan", href: "/sales-report", icon: "📋" },
    { id: "stock-card", label: "Kartu Stock", href: "/stock-card", icon: "🗂️" },
    { id: "cash-count", label: "Daily Cash Count", href: "/cash-count", icon: "💰" },
    { id: "import-sales", label: "Import Penjualan", href: "/import-sales", icon: "⚡" },
    { id: "suppliers", label: "Kelola Supplier", href: "/suppliers", icon: "🤝" },
  ];

  const warungMenus = [
    { id: "warung_dashboard", label: "Dashboard Warung", icon: "🏪" },
    { id: "warung_pos", label: "Kasir / POS", icon: "💳" },
    { id: "warung_products", label: "Master Produk", icon: "📦" },
    { id: "warung_suppliers", label: "Supplier", icon: "🤝" },
    { id: "warung_stock", label: "Stock", icon: "📊" },
    { id: "warung_stock_card", label: "Kartu Stock", icon: "🗂️" },
    { id: "warung_stock_opname", label: "Stock Opname", icon: "📋" },
    { id: "warung_adjustment_ip", label: "Adjustment (IP)", icon: "⚖️" },
    { id: "warung_breakage", label: "Breakage / Susut", icon: "⚠️" },
    { id: "warung_po", label: "Purchase Order", icon: "📝" },
    { id: "warung_receiving", label: "Receiving", icon: "📥" },
    { id: "warung_returns", label: "Retur Pembelian", icon: "↩️" },
    { id: "warung_cash_count", label: "Cash Count", icon: "💰" },
    { id: "warung_cash_flow", label: "Kas Masuk / Keluar", icon: "💵" },
    { id: "warung_receivables", label: "Piutang", icon: "📈" },
    { id: "warung_payables", label: "Utang", icon: "📉" },
    { id: "warung_coa", label: "Chart of Accounts", icon: "🧾" },
    { id: "warung_journals", label: "Jurnal Umum", icon: "📒" },
    { id: "warung_income_statement", label: "Laba Rugi", icon: "📊" },
    { id: "warung_balance_sheet", label: "Neraca", icon: "⚖️" },
    { id: "warung_fiscal_periods", label: "Tutup Periode", icon: "🔒" },
    { id: "warung_reports", label: "Laporan", icon: "📑" },
    { id: "warung_settings", label: "Pengaturan Warung", icon: "⚙️" },
  ];

  const portalMenus = [
    { id: "portal_profile", label: "Profil Pengguna", icon: "👤" },
    { id: "portal_staff", label: "Staff", icon: "👥" },
    { id: "portal_access", label: "Akses ke Setiap Usaha", icon: "🔐" },
    { id: "portal_security", label: "Keamanan & Sesi Login", icon: "🛡️" },
  ];

  const isHomeActive = pathname === "/" && activeTab === "dashboard";

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-slate-100 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0 select-none z-30">
      <div className="flex flex-col gap-3">
        {/* Brand Header */}
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-bold">Business Control Center</div>
          <div className="text-base font-extrabold text-white mt-0.5 tracking-tight">Emir Cell & Atin Group</div>
        </div>

        {/* Dashboard Utama */}
        <Link
          href="/"
          onClick={() => setActiveTab && setActiveTab("dashboard")}
          className={
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all " +
            (isHomeActive
              ? "bg-indigo-600 text-white font-semibold shadow-sm"
              : "text-slate-300 hover:bg-slate-800 hover:text-white")
          }
        >
          <span>🏠</span>
          <span>Dashboard Utama</span>
        </Link>

        {/* WMS */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setOpenWms(!openWms)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-rose-400">🏷️</span>
              <span className="font-semibold text-rose-300">Atin&apos;s Collection</span>
            </div>
            <span className={"text-[10px] text-slate-400 transform transition-transform " + (openWms ? "rotate-180" : "")}>
              ▾
            </span>
          </button>
          {openWms && (
            <div className="mt-1 pl-3 ml-3 border-l-2 border-rose-500/30 flex flex-col gap-1">
              {wmsMenus.map((item) => {
                const isActive = pathname === "/" && activeTab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setActiveTab && setActiveTab(item.id)}
                    className={
                      "w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all " +
                      (isActive
                        ? "bg-rose-500/20 text-rose-300 font-bold border-l-2 border-rose-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60")
                    }
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* KONTER */}
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
            <span className={"text-[10px] text-slate-400 transform transition-transform " + (openKonter ? "rotate-180" : "")}>
              ▾
            </span>
          </button>
          {openKonter && (
            <div className="mt-1 pl-3 ml-3 border-l-2 border-emerald-500/30 flex flex-col gap-1 max-h-[380px] overflow-y-auto pr-1">
              {konterMenus.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all " +
                      (isActive
                        ? "bg-emerald-500/20 text-emerald-300 font-bold border-l-2 border-emerald-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60")
                    }
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* WARUNG */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setOpenWarung(!openWarung)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-400">🏪</span>
              <span className="font-semibold text-amber-300">Operasional Warung</span>
            </div>
            <span className={"text-[10px] text-slate-400 transform transition-transform " + (openWarung ? "rotate-180" : "")}>
              ▾
            </span>
          </button>
          {openWarung && (
            <div className="mt-1 pl-3 ml-3 border-l-2 border-amber-500/30 flex flex-col gap-1 max-h-[380px] overflow-y-auto pr-1">
              {warungMenus.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab && setActiveTab(item.id)}
                    className={
                      "w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all " +
                      (isActive
                        ? "bg-amber-500/20 text-amber-300 font-bold border-l-2 border-amber-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60")
                    }
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* PORTAL SETTINGS */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setOpenPortal(!openPortal)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sky-400">⚙️</span>
              <span className="font-semibold text-sky-300">Pengaturan Portal</span>
            </div>
            <span className={"text-[10px] text-slate-400 transform transition-transform " + (openPortal ? "rotate-180" : "")}>
              ▾
            </span>
          </button>
          {openPortal && (
            <div className="mt-1 pl-3 ml-3 border-l-2 border-sky-500/30 flex flex-col gap-1">
              {portalMenus.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab && setActiveTab(item.id)}
                    className={
                      "w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all " +
                      (isActive
                        ? "bg-sky-500/20 text-sky-300 font-bold border-l-2 border-sky-400"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60")
                    }
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="text-[11px] text-slate-400 px-2 flex justify-between items-center">
          <span>Role: <span className="text-emerald-400 font-semibold">{userRole || "ROOT_ADMIN"}</span></span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">Portal Active</span>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition"
          >
            Keluar / Logout
          </button>
        )}
      </div>
    </aside>
  );
}