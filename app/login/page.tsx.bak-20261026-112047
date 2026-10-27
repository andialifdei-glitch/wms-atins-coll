"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { userDb as db } from "@/lib/firebase";

async function sha256Hex(message: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return message;
}

function normalizeRole(rawRole: string): "ROOT_ADMIN" | "ADMIN_GUDANG" | "STAFF_GUDANG" {
  const r = (rawRole || "").trim().toUpperCase();
  if (r.includes("ROOT") || r === "ADMIN" || r === "SUPER ADMIN") return "ROOT_ADMIN";
  if (r.includes("ADMIN") || r.includes("GUDANG_ADMIN")) return "ADMIN_GUDANG";
  return "STAFF_GUDANG";
}

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
      const rawInput = userId.trim();
      const inputPass = password.trim();

      if (!rawInput || !inputPass) {
        setErrorMsg("User ID dan Password wajib diisi.");
        setLoading(false);
        return;
      }

      const cleanInput = rawInput.includes("@") ? rawInput.split("@")[0] : rawInput;
      const lowerInput = cleanInput.toLowerCase();

      let userData: any = null;
      let finalDocId = lowerInput;

      // 1. Cek langsung ke Firestore via browser
      try {
        const docRef = doc(db, "users", lowerInput);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          userData = docSnap.data();
          finalDocId = docSnap.id;
        }
      } catch (e) {
        console.warn("Direct doc read warning:", e);
      }

      // 2. Jika tidak ada, cari via query field
      if (!userData) {
        const usersCol = collection(db, "users");
        const fields = ["userId", "username", "email"];
        for (const f of fields) {
          try {
            const q = query(usersCol, where(f, "==", lowerInput));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              userData = qSnap.docs[0].data();
              finalDocId = qSnap.docs[0].id;
              break;
            }
          } catch {}
        }
      }

      // 3. Cek dengan casing asli jika ada perbedaan huruf besar/kecil
      if (!userData && cleanInput !== lowerInput) {
        try {
          const docRef = doc(db, "users", cleanInput);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            userData = docSnap.data();
            finalDocId = docSnap.id;
          }
        } catch {}
      }

      if (!userData) {
        setErrorMsg("Pengguna tidak ditemukan. Periksa kembali User ID Anda.");
        setLoading(false);
        return;
      }

      if (userData.active === false) {
        setErrorMsg("Akun dinonaktifkan. Hubungi Administrator.");
        setLoading(false);
        return;
      }

      // 4. Verifikasi Password (Plain text atau SHA-256)
      const storedPass = String(userData.password || "");
      let isMatch = false;

      if (storedPass === inputPass) {
        isMatch = true;
      } else {
        const hashed = await sha256Hex(inputPass);
        if (hashed.toLowerCase() === storedPass.toLowerCase()) {
          isMatch = true;
        }
      }

      if (!isMatch) {
        setErrorMsg("Kombinasi User ID dan Password tidak sah.");
        setLoading(false);
        return;
      }

      // 5. Buat Sesi Pengguna
      const uId = userData.userId || userData.username || finalDocId;
      const sessionPayload = {
        uid: userData.uid || finalDocId,
        id: uId,
        email: userData.email || `${uId}@wms.atinscollection.com`,
        role: normalizeRole(userData.role || ""),
        name: userData.fullName || userData.name || uId,
      };

      // Simpan session di LocalStorage
      localStorage.setItem("wms_user_session", JSON.stringify(sessionPayload));

      // Simpan session di Cookie agar middleware/SSR rute lain mendeteksi user sudah login
      const sessionString = encodeURIComponent(JSON.stringify(sessionPayload));
      document.cookie = `admin_session=${sessionString}; path=/; max-age=86400; SameSite=Lax`;

      // Redirect ke Dashboard Utama
      router.push("/");
      router.refresh();
    } catch (err: any) {
      console.error("Login Error:", err);
      setErrorMsg("Gagal melakukan login: " + (err.message || "Koneksi bermasalah"));
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