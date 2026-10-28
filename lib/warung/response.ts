import { NextResponse } from "next/server";

export function okResponse<T = any>(data: T, message?: string) {
  return NextResponse.json({ success: true, data, message });
}

export function errorResponse(message: string, status = 400, extra?: any) {
  return NextResponse.json({ success: false, message, ...(extra || {}) }, { status });
}

export function unauthorizedResponse(message = "Akses ditolak. Sesi tidak sah.") {
  return errorResponse(message, 401);
}

export function forbiddenResponse(message = "Akses ditolak.") {
  return errorResponse(message, 403);
}

export function notFoundResponse(message = "Data tidak ditemukan.") {
  return errorResponse(message, 404);
}