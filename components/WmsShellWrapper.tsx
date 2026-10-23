"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function WmsShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  const ResolvedSidebar = (Sidebar as any)?.default || Sidebar;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <ResolvedSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-900/50 p-6">
        {children}
      </main>
    </div>
  );
}
