import { cookies } from "next/headers";

export interface KonterUserSession {
  uid: string;
  id: string;
  email: string;
  role: "ROOT_ADMIN" | "ADMIN_GUDANG" | "STAFF_GUDANG";
  name: string;
}

/**
 * Membaca sesi aktif WMS dari cookie `admin_session`
 */
export async function getKonterSession(): Promise<KonterUserSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const rawData = decodeURIComponent(sessionCookie.value);
    const parsed = JSON.parse(rawData);
    if (!parsed.uid || !parsed.role) return null;
    return parsed as KonterUserSession;
  } catch {
    return null;
  }
}