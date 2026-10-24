import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Lewati static assets, internal Next.js, API, dan file dengan ekstensi
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("admin_session")?.value;

  // 2. Proteksi rute selain /login jika belum ada session
  if (!sessionCookie && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 3. Jika sudah login dan membuka /login, arahkan ke dashboard
  if (sessionCookie && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Hanya jalankan middleware pada rute halaman (bukan asset / file statis)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};