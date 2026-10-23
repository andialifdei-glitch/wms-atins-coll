import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

function normalizeRole(rawRole: string): "ROOT_ADMIN" | "ADMIN_GUDANG" | "STAFF_GUDANG" {
  const r = (rawRole || "").trim().toUpperCase();
  if (r.includes("ROOT") || r === "ADMIN" || r === "SUPER ADMIN") return "ROOT_ADMIN";
  if (r.includes("ADMIN") || r.includes("GUDANG_ADMIN")) return "ADMIN_GUDANG";
  return "STAFF_GUDANG";
}

function verifyPasswordMatch(inputPassword: string, storedPassword: string): boolean {
  if (!storedPassword) return false;
  
  // 1. Cek kecocokan langsung (jika plain text)
  if (inputPassword === storedPassword) return true;

  // 2. Cek kecocokan jika disimpan dalam format SHA-256
  const sha256 = crypto.createHash("sha256").update(inputPassword).digest("hex");
  if (sha256.toLowerCase() === storedPassword.toLowerCase()) return true;

  // 3. Cek kecocokan jika disimpan dalam format MD5
  const md5 = crypto.createHash("md5").update(inputPassword).digest("hex");
  if (md5.toLowerCase() === storedPassword.toLowerCase()) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawInput = String(body.userId || body.username || body.email || "").trim();
    const password = String(body.password || "").trim();

    if (!rawInput || !password) {
      return NextResponse.json({ success: false, message: "User ID dan Password wajib diisi." }, { status: 400 });
    }

    const cleanId = rawInput.includes("@") ? rawInput.split("@")[0].toLowerCase() : rawInput.toLowerCase();
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB04dGkGOXRV8gCOlrWoPKaPm8pUHxmS9w";

    // Ambil dokumen user langsung dari Firestore
    const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${cleanId}?key=${apiKey}`;
    const res = await fetch(docUrl, { cache: "no-store" });

    if (!res.ok) {
      // Jika dokumen dengan ID tidak ditemukan, cari berdasarkan field userId / username
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${apiKey}`;
      const queryPayload = {
        structuredQuery: {
          from: [{ collectionId: "users" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "userId" },
              op: "EQUAL",
              value: { stringValue: cleanId },
            },
          },
          limit: 1,
        },
      };

      const queryRes = await fetch(queryUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryPayload),
      });

      const queryData = await queryRes.json();
      const firstDoc = Array.isArray(queryData) ? queryData.find((d: any) => d.document) : null;

      if (!firstDoc || !firstDoc.document) {
        return NextResponse.json({ success: false, message: "Pengguna tidak ditemukan." }, { status: 401 });
      }

      return processUserDocument(firstDoc.document, password, cleanId);
    }

    const docData = await res.json();
    return processUserDocument(docData, password, cleanId);
  } catch (error: any) {
    console.error("[LOGIN ERROR]:", error);
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server saat login." }, { status: 500 });
  }
}

function processUserDocument(docData: any, inputPassword: string, fallbackId: string) {
  const fields = docData.fields || {};
  const storedPassword = fields.password?.stringValue || "";
  const isActive = fields.active ? fields.active.booleanValue !== false : true;

  if (!isActive) {
    return NextResponse.json({ success: false, message: "Akun dinonaktifkan. Hubungi Administrator." }, { status: 403 });
  }

  // Verifikasi kecocokan password
  const isValid = verifyPasswordMatch(inputPassword, storedPassword);
  if (!isValid) {
    return NextResponse.json({ success: false, message: "Kombinasi User ID dan Password tidak sah." }, { status: 401 });
  }

  const userId = fields.userId?.stringValue || fields.username?.stringValue || fallbackId;
  const fullName = fields.fullName?.stringValue || fields.name?.stringValue || userId;
  const role = normalizeRole(fields.role?.stringValue || "");
  const email = fields.email?.stringValue || `${userId}@wms.atinscollection.com`;
  const uid = fields.uid?.stringValue || docData.name?.split("/").pop() || userId;

  const sessionPayload = {
    uid: uid,
    id: userId,
    email: email,
    role: role,
    name: fullName,
  };

  const response = NextResponse.json({
    success: true,
    message: "Autentikasi terverifikasi.",
    data: sessionPayload,
  });

  response.cookies.set("admin_session", encodeURIComponent(JSON.stringify(sessionPayload)), {
    path: "/",
    maxAge: 60 * 60 * 24, // 24 jam
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}