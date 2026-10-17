"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), password: password.trim() }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        if (result.data) {
          localStorage.setItem("wms_user_session", JSON.stringify(result.data));
        }
        router.push("/");
        router.refresh();
      } else {
        setErrorMsg(result.message || "Autentikasi gagal. Periksa User ID dan Password Anda.");
      }
    } catch {
      setErrorMsg("Gagal terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2D121F] p-4 font-sans text-slate-800">
      <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl border border-rose-100/50">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">WMS Atin&apos;s Collection</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Warehouse Management System Portal</p>
        </div>

        {errorMsg && (
          <div className="p-3 mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">User ID / Email</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Masukkan User ID atau Email"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg outline-none font-medium focus:border-[#BE185D] focus:ring-1 focus:ring-[#BE185D] transition bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              placeholder="Masukkan Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg outline-none font-medium focus:border-[#BE185D] focus:ring-1 focus:ring-[#BE185D] transition bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm transition duration-150"
          >
            {loading ? "Memverifikasi Kredensial..." : "Masuk"}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 font-medium">Sistem Terintegrasi Gudang &amp; Logistik</p>
        </div>
      </div>
    </div>
  );
}