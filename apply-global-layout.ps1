$root =$PWD
Write-Host "=== MEMINDAHKAN BCC LAYOUT KE KOMPONEN GLOBAL ===" -ForegroundColor Cyan

# 1. Simpan layout BCC sebagai komponen pembungkus global
$wrapperCode = @'
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function BCCLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Jika di halaman login, tampilkan tanpa sidebar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const [openGroups, setOpenGroups] = useState<{ [key: string]: boolean }>({
    "Dashboard Utama": true,
    "Kelola Stock & Gudang": true,
    "Purchase & Receiving": true,
    "Laporan & Analisis": true,
    "Konter & PPOB": true,
    "Manajerial & Pengaturan": true,
  });

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const navGroups = [
    {
      group: "Dashboard Utama",
      items: [
        { label: "Dashboard WMS", href: "/" },
        { label: "Dashboard Konter", href: "/konter" },
      ]
    },
    {
      group: "Kelola Stock & Gudang",
      items: [
        { label: "Pengelolaan Stock", href: "/master" },
        { label: "Stock Movement Log", href: "/movement" },
        { label: "Stock Adjustment", href: "/adjustment" },
      ]
    },
    {
      group: "Purchase & Receiving",
      items: [
        { label: "Purchase Order (PO)", href: "/purchase" },
        { label: "Penerimaan (Receiving)", href: "/receiving" },
      ]
    },
    {
      group: "Laporan & Analisis",
      items: [
        { label: "Laporan Penjualan", href: "/sales-report" },
        { label: "Laporan Stock", href: "/stock-report" },
        { label: "Laporan Stock Adjustment", href: "/adjustment" },
        { label: "Laporan Receiving", href: "/receiving-report" },
        { label: "Laporan PO", href: "/po-report" },
        { label: "Kartu Stock", href: "/stock-card" },
      ]
    },
    {
      group: "Konter & PPOB",
      items: [
        { label: "Import Penjualan", href: "/import-sales" },
        { label: "Daily Cash Count", href: "/cash-count" },
        { label: "Kelola Supplier", href: "/suppliers" },
      ]
    },
    {
      group: "Manajerial & Pengaturan",
      items: [
        { label: "Pengelolaan Family", href: "/master?tab=family" },
      ]
    }
  ];

  function handleLogout() {
    if (!confirm("Apakah Anda yakin ingin keluar dari sistem?")) return;
    localStorage.removeItem("wms_user_session");
    document.cookie = "admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#FDF8F9] text-slate-800 flex flex-col font-sans select-none">
      <header className="bg-[#2D121F] text-white px-5 py-3.5 flex items-center justify-between border-b border-rose-950/40 shadow-md shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-rose-200 transition"
            title="Toggle Sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">Business Control Centre</h1>
            <p className="text-[10px] text-rose-300 font-medium">Sistem Pengendalian Terpadu</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="block text-[11px] font-bold text-rose-100">Single Account (WMS)</span>
            <span className="block text-[9px] text-emerald-400 font-semibold">Active Session</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            Keluar Akun
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <aside
            className="w-64 bg-[#2D121F] border-r border-rose-950/40 flex flex-col justify-between shrink-0 z-10 overflow-y-auto"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#BE185D #2D121F"
            }}
          >
            <div className="p-3 space-y-3 flex-1">
              {navGroups.map((groupObj) => {
                const isOpen = openGroups[groupObj.group] ?? true;
                return (
                  <div key={groupObj.group} className="space-y-1">
                    <button
                      onClick={() => toggleGroup(groupObj.group)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-rose-200 uppercase hover:bg-white/5 rounded-lg transition"
                    >
                      <span>{groupObj.group}</span>
                      <span className="text-rose-400 text-xs">{isOpen ? "?" : "?"}</span>
                    </button>

                    {isOpen && (
                      <div className="pl-2 space-y-0.5 border-l border-rose-900/50 ml-3">
                        {groupObj.items.map((item) => {
                          const isActive = pathname === item.href.split("?")[0];
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                isActive
                                  ? "bg-[#BE185D] text-white shadow-sm font-bold"
                                  : "text-rose-100/80 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-[#240e19] border-t border-rose-950/60 text-center shrink-0">
              <span className="text-[10px] text-rose-300/50 font-medium">BCC Integrated System v3.0</span>
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-y-auto p-6 bg-[#FDF8F9]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
