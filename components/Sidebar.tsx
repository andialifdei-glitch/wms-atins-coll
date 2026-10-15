"use client";
import { useState } from 'react';
import Link from 'next/link';

export default function Sidebar() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleMenu = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  return (
    <aside className="w-64 min-h-screen bg-[#FFF8F8] border-r border-[#F0D5D5] p-4 flex flex-col gap-2">
      <div className="px-3 py-4 text-xl font-bold text-[#A75D5D]">
        Atin&apos;s Collection
      </div>

      <Link href="/dashboard" className="px-3 py-2 rounded-lg hover:bg-[#FBE8E8] text-gray-700 font-medium">
        Dashboard
      </Link>

      <div>
        <button
          onClick={() => toggleMenu('master')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#FBE8E8] text-gray-700 font-medium"
        >
          <span>Master Katalog</span>
          <span className={`text-xs transition-transform ${openDropdown === 'master' ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {openDropdown === 'master' && (
          <div className="pl-4 mt-1 flex flex-col gap-1 border-l-2 border-[#E8C5C5] ml-3">
            <Link href="/catalog/products" className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#A75D5D]">
              Daftar Produk
            </Link>
            <Link href="/catalog/categories" className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#A75D5D]">
              Kategori & Assortment
            </Link>
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => toggleMenu('reports')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#FBE8E8] text-gray-700 font-medium"
        >
          <span>Laporan</span>
          <span className={`text-xs transition-transform ${openDropdown === 'reports' ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {openDropdown === 'reports' && (
          <div className="pl-4 mt-1 flex flex-col gap-1 border-l-2 border-[#E8C5C5] ml-3">
            <Link href="/reports/stock" className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#A75D5D]">
              Laporan Stok
            </Link>
            <Link href="/reports/sales" className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#A75D5D]">
              Laporan Penjualan
            </Link>
            <Link href="/reports/hr" className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#A75D5D]">
              Laporan SDM
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
