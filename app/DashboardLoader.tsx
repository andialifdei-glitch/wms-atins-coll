"use client";
import dynamic from "next/dynamic";

const DashboardClient = dynamic(() => import("./DashboardClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        <p className="text-sm font-medium tracking-wide text-slate-300">
          Memuat WMS Atin Portal...
        </p>
      </div>
    </div>
  ),
});

export default function DashboardLoader() {
  return <DashboardClient />;
}
