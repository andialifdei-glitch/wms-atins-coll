import { NextRequest } from "next/server";
import { getGoogleAccessToken } from "@/lib/firebase-admin";

export interface WarungSessionUser {
  id: string;
  uid: string;
  role: string;
  name: string;
  email: string;
}

const SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/cloud-platform",
];
const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

export async function getWarungSessionUser(request: NextRequest): Promise<WarungSessionUser | null> {
  const cookie = request.cookies.get("admin_session")?.value;
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookie));
    if (!parsed) return null;

    const token = await getGoogleAccessToken(SCOPES);
    const candidates = [parsed.id, parsed.uid].filter(Boolean);
    for (const cand of candidates) {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${encodeURIComponent(cand)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) continue;
      const doc: any = await res.json();
      const isActive = doc.fields?.active?.booleanValue ?? true;
      if (!isActive) return null;
      return {
        id: doc.fields?.userId?.stringValue || cand,
        uid: doc.fields?.uid?.stringValue || parsed.uid,
        role: String(doc.fields?.role?.stringValue || parsed.role || "").toUpperCase(),
        name: doc.fields?.fullName?.stringValue || "",
        email: doc.fields?.email?.stringValue || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function requireRole(user: WarungSessionUser | null, roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}