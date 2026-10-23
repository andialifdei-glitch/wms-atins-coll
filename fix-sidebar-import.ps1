$root =$PWD
Write-Host "=== MEMPERBAIKI EKSPOR SIDEBAR ===" -ForegroundColor Cyan

# 1. Pastikan components/Sidebar.tsx memiliki default dan named export
$sidebarFile = "$root\components\Sidebar.tsx"
if (Test-Path $sidebarFile) {
    $sbText = [System.IO.File]::ReadAllText($sidebarFile, [System.Text.Encoding]::UTF8)
    
    # Hapus export default ganda jika ada
    $sbText =$sbText -replace 'export default Sidebar;?', ''
    
    # Tambahkan di baris paling akhir
    $sbText += "`nexport { Sidebar };`nexport default Sidebar;`n"
    
    [System.IO.File]::WriteAllText($sidebarFile, $sbText, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "[1/3] components/Sidebar.tsx diperbarui dengan dual export." -ForegroundColor Green
}

# 2. Tulis ulang components/WmsShellWrapper.tsx dengan import yang aman
$wrapperFile = "$root\components\WmsShellWrapper.tsx"
$wrapperCode = @'
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import SidebarComponent from "@/components/Sidebar";

export default function WmsShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Khusus halaman login, render penuh tanpa sidebar
  if (pathname === "/login") {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  // Fallback komponen jika modul terbaca sebagai modul namespace
  const ResolvedSidebar = (SidebarComponent as any)?.default || SidebarComponent;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <ResolvedSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-900/50 p-6">
        {children}
      </main>
    </div>
  );
}
