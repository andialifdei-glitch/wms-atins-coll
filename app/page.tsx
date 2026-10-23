"use client";

import React, { useState, useEffect } from "react";
import DashboardClient from "./DashboardClient";

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#2D121F] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wide">Memuat Sistem WMS & Konter...</span>
        </div>
      </div>
    );
  }

  return <DashboardClient />;
}
