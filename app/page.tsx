"use client";

import dynamic from "next/dynamic";

const DashboardClient = dynamic(() => import("./DashboardClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 text-gray-600 font-medium">
      Memuat Data Portal...
    </div>
  ),
});

export default function Page() {
  return <DashboardClient />;
}