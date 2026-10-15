import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function verifyRootAdmin(req: NextRequest): { authorized: boolean; user?: any } {
  try {
    const sessionCookie = req.cookies.get("admin_session")?.value;
    if (!sessionCookie) return { authorized: false };
    const user = JSON.parse(decodeURIComponent(sessionCookie));
    const role = String(user.role || "").toLowerCase();
    const username = String(user.username || user.userId || user.id || "").toLowerCase();
    if (username === "admin" || role.includes("root")) {
      return { authorized: true, user };
    }
  } catch {}
  return { authorized: false };
}

export async function POST(req: NextRequest) {
  const auth = verifyRootAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, message: "Akses ditolak: Operasi ini hanya diizinkan untuk ROOT_ADMIN." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toUpperCase();

    // Verifikasi payload action
    if (!action) {
      return NextResponse.json({ success: false, message: "Action wajib disertakan." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Authorized by server-side Root Admin.", actor: auth.user.name });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || "Internal server error" }, { status: 500 });
  }
}
