import { NextRequest, NextResponse } from "next/server";
import { createAuthUser, deleteAuthUser } from "@/lib/firebase-auth";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("admin_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, message: "Autentikasi diperlukan." }, { status: 401 });
    }

    let caller: any;
    try {
      caller = JSON.parse(decodeURIComponent(sessionCookie));
    } catch {
      return NextResponse.json({ success: false, message: "Sesi tidak valid." }, { status: 401 });
    }

    const callerRole = String(caller.role || "").toUpperCase();
    if (callerRole !== "ROOT_ADMIN" && caller.id !== "admin") {
      return NextResponse.json({ success: false, message: "Akses ditolak. Khusus ROOT_ADMIN." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { staffId, fullName, userId, password, role } = body;

    if (!fullName || !userId || !password) {
      return NextResponse.json({ success: false, message: "Seluruh kolom wajib diisi." }, { status: 400 });
    }

    if (String(password).length < 6) {
      return NextResponse.json({ success: false, message: "Password minimal 6 karakter." }, { status: 400 });
    }

    const cleanUserId = String(userId).trim().toLowerCase();
    const assignedRole = role === "ADMIN_GUDANG" ? "ADMIN_GUDANG" : "STAFF_GUDANG";
    const email = `${cleanUserId}@wms.atinscollection.com`;

    let authUser: any;
    try {
      authUser = await createAuthUser(email, String(password).trim(), String(fullName).trim());
    } catch (err: any) {
      if (String(err.message).includes("EMAIL_EXISTS")) {
        return NextResponse.json({ success: false, message: "User ID / Email sudah terdaftar." }, { status: 409 });
      }
      return NextResponse.json({ success: false, message: "Gagal membuat kredensial akun." }, { status: 500 });
    }

    const uid = authUser.localId;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

    const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${cleanUserId}?key=${apiKey}`;
    const firestorePayload = {
      fields: {
        uid: { stringValue: uid },
        staffId: { stringValue: String(staffId || "") },
        userId: { stringValue: cleanUserId },
        username: { stringValue: cleanUserId },
        email: { stringValue: email },
        fullName: { stringValue: String(fullName).trim() },
        name: { stringValue: String(fullName).trim() },
        role: { stringValue: assignedRole },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: caller.name || caller.id },
      },
    };

    const fsRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(firestorePayload),
    });

    if (!fsRes.ok) {
      await deleteAuthUser(authUser.idToken).catch(() => {});
      return NextResponse.json(
        { success: false, message: "Gagal menyinkronkan profil database." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pengguna [${cleanUserId}] berhasil dibuat dengan role ${assignedRole}.`,
      data: { uid, userId: cleanUserId, role: assignedRole },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Terjadi kesalahan server internal." }, { status: 500 });
  }
}