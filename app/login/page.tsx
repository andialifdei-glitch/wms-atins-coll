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
        body: JSON.stringify({ userId, password }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMsg(result.message || "Gagal login");
      }
    } catch {
      setErrorMsg("Koneksi gagal, silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#4A2033] p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-rose-100">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-rose-950">Warehouse Management System</h1>
          <p className="text-xs text-rose-600 mt-2 font-medium">
            Report Portal by Atin&apos;s Collection IT Support
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-rose-900 mb-2">
              User ID
            </label>
            <input
              type="text"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Masukkan User ID"
              className="w-full px-4 py-2.5 rounded-lg border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-[#BE185D] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-rose-900 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-[#BE185D] focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-rose-300 text-white font-semibold rounded-lg text-sm shadow-md transition-all mt-2 cursor-pointer"
          >
            {loading ? "Memverifikasi..." : "Login Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}