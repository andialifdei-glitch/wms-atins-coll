import { NextRequest, NextResponse } from "next/server";
import { verifyUserPassword } from "@/lib/firebase-auth";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

function normalizeRole(rawRole: string): "ROOT_ADMIN" | "ADMIN_GUDANG" | "STAFF_GUDANG" {
  const r = (rawRole || "").trim().toUpperCase();
  if (r.includes("ROOT") || r === "ADMIN" || r === "SUPER ADMIN") return "ROOT_ADMIN";
  if (r.includes("ADMIN") || r.includes("GUDANG_ADMIN")) return "ADMIN_GUDANG";
  return "STAFF_GUDANG";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawInput = String(body.userId || body.username || body.email || "").trim();
    const password = String(body.password || "").trim();

    if (!rawInput || !password) {
      return NextResponse.json({ success: false, message: "Kredensial wajib diisi lengkap." }, { status: 400 });
    }

    const email = rawInput.includes("@")
      ? rawInput.toLowerCase()
      : `${rawInput.toLowerCase()}@wms.atinscollection.com`;

    let authData: any;
    try {
      authData = await verifyUserPassword(email, password);
    } catch {
      return NextResponse.json({ success: false, message: "Kombinasi User ID dan Password tidak sah." }, { status: 401 });
    }

    const uid = authData.localId;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

    let resolvedRole: "ROOT_ADMIN" | "ADMIN_GUDANG" | "STAFF_GUDANG" = "STAFF_GUDANG";
    let resolvedFullName = authData.displayName || "";
    let isActive = true;

    const docUrlUid = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${uid}?key=${apiKey}`;
    const resUid = await fetch(docUrlUid, {
      headers: { Authorization: `Bearer ${authData.idToken}` },
      cache: "no-store",
    });

    if (resUid.ok) {
      const data = await resUid.json();
      const fields = data.fields || {};
      isActive = fields.active ? fields.active.booleanValue !== false : true;
      resolvedRole = normalizeRole(fields.role?.stringValue || "");
      resolvedFullName = fields.fullName?.stringValue || fields.name?.stringValue || resolvedFullName;
    } else {
      const cleanId = rawInput.toLowerCase();
      const docUrlId = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${cleanId}?key=${apiKey}`;
      const resId = await fetch(docUrlId, {
        headers: { Authorization: `Bearer ${authData.idToken}` },
        cache: "no-store",
      });

      if (resId.ok) {
        const data = await resId.json();
        const fields = data.fields || {};
        isActive = fields.active ? fields.active.booleanValue !== false : true;
        resolvedRole = normalizeRole(fields.role?.stringValue || "");
        resolvedFullName = fields.fullName?.stringValue || fields.name?.stringValue || resolvedFullName;
      }
    }

    if (!isActive) {
      return NextResponse.json({ success: false, message: "Akun dinonaktifkan. Hubungi Administrator." }, { status: 403 });
    }

    const finalFullName = resolvedFullName.trim() || authData.displayName || rawInput;

    const sessionPayload = {
      uid: uid,
      id: rawInput,
      email: email,
      role: resolvedRole,
      name: finalFullName,
    };

    const response = NextResponse.json({
      success: true,
      message: "Autentikasi terverifikasi.",
      data: sessionPayload,
    });

    response.cookies.set("admin_session", encodeURIComponent(JSON.stringify(sessionPayload)), {
      path: "/",
      maxAge: 60 * 60 * 12,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, message: "Terjadi kesalahan sistem saat autentikasi." }, { status: 500 });
  }
}