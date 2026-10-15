import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("admin_session")?.value;
  const { pathname } = request.nextUrl;

  // Lewati static assets, API internal, dan file gambar
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // Jika belum login dan mengakses halaman terproteksi selain /login
  if (!sessionCookie && pathname !== "/login") {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Jika sudah login dan mencoba mengakses halaman /login kembali
  if (sessionCookie && pathname === "/login") {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Proteksi semua route kecuali file statis Next.js dan favicon
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};