"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KonterRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
      <p className="text-sm">Mengalihkan ke Dashboard Terpadu...</p>
    </div>
  );
}
