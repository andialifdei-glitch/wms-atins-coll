import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const ROOT_ID = "admin";
const ROOT_HASH = crypto.createHash("sha256").update("rootadmin").digest("hex");

export async function POST(request: Request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { success: false, message: "ID dan Password wajib diisi" },
        { status: 400 }
      );
    }

    const inputHash = crypto.createHash("sha256").update(password.trim()).digest("hex");
    let authenticatedUser: { id: string; role: string; name: string } | null = null;

    // 1. Cek Root Admin terlebih dahulu
    if (userId.trim() === ROOT_ID && inputHash === ROOT_HASH) {
      authenticatedUser = { id: "admin", role: "Admin", name: "Super Admin" };
    } else {
      // 2. Cek akun tambahan dari Firestore 'portal_users'
      try {
        const q = query(collection(db, "portal_users"), where("username", "==", userId.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const uDoc = snap.docs[0].data();
          if (uDoc.passwordHash === inputHash) {
            authenticatedUser = {
              id: userId.trim(),
              role: uDoc.role || "Staff",
              name: uDoc.fullName || userId.trim(),
            };
          }
        }
      } catch (err) {
        console.error("Firestore user search error:", err);
      }
    }

    if (authenticatedUser) {
      const response = NextResponse.json({ success: true, user: authenticatedUser });
      const cookieValue = encodeURIComponent(JSON.stringify(authenticatedUser));

      response.cookies.set("admin_session", cookieValue, {
        path: "/",
        maxAge: 60 * 60 * 12,
        sameSite: "lax",
      });

      return response;
    }

    return NextResponse.json(
      { success: false, message: "User ID atau Password tidak cocok!" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi gangguan sistem login" },
      { status: 500 }
    );
  }
}