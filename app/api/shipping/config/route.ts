import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";
const KOMERCE_BASE = "https://rajaongkir.komerce.id/api/v1";
const DATABASE_SCOPES = ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"];

async function verifySessionViaAdmin(request: NextRequest) {
  const cookie = request.cookies.get("admin_session")?.value;
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookie));
    if (!parsed?.role || (!parsed?.id && !parsed?.uid)) return null;
    const token = await getGoogleAccessToken(DATABASE_SCOPES);
    const candidates = [parsed.id, parsed.uid].filter(Boolean);
    for (const cand of candidates) {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${encodeURIComponent(cand)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) {
        const doc: any = await r.json();
        const isActive = doc.fields?.active?.booleanValue ?? true;
        if (!isActive) return null;
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function testKomerceKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${KOMERCE_BASE}/destination/domestic-destination?search=bandung&limit=1`, {
      headers: { key: apiKey, Accept: "application/json" },
    });
    const text = await res.text().catch(() => "");
    if (res.ok) return { ok: true, message: "OK" };
    if (res.status === 401 || res.status === 403) return { ok: false, message: "API key tidak valid atau tidak aktif." };
    if (res.status === 429) return { ok: false, message: "Kuota API key habis." };
    return { ok: false, message: `Komerce HTTP ${res.status}: ${text.slice(0, 150)}` };
  } catch (e: any) {
    return { ok: false, message: "Gagal menghubungi Komerce: " + e.message };
  }
}

export async function POST(request: NextRequest) {
  const user = await verifySessionViaAdmin(request);
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak. Sesi tidak sah." }, { status: 401 });
  }
  const role = String(user.role || "").toUpperCase();
  if (role !== "ROOT_ADMIN" && user.id !== "admin") {
    return NextResponse.json({ success: false, message: "Hanya ROOT_ADMIN yang boleh mengubah API Key." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").toUpperCase();
  const apiKey = String(body.apiKey || body.rajaOngkirApiKey || "").trim();

  if (!apiKey) return NextResponse.json({ success: false, message: "API key wajib diisi." }, { status: 400 });

  if (action === "TEST_CONNECTION") {
    const { ok, message } = await testKomerceKey(apiKey);
    if (!ok) return NextResponse.json({ success: false, message }, { status: 400 });
    return NextResponse.json({ success: true, message: "API Key valid." });
  }

  if (action === "SAVE" || action === "SAVE_KEY" || action === "SAVE_CONFIG" || action === "") {
    const { ok, message } = await testKomerceKey(apiKey);
    if (!ok) return NextResponse.json({ success: false, message }, { status: 400 });

    try {
      const token = await getGoogleAccessToken(DATABASE_SCOPES);
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_info?updateMask.fieldPaths=rajaOngkirApiKey`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: { rajaOngkirApiKey: { stringValue: apiKey } } }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return NextResponse.json({ success: false, message: "Gagal simpan ke Firestore.", detail: txt.slice(0, 300) }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "API Key RajaOngkir tersimpan." });
    } catch (e: any) {
      return NextResponse.json({ success: false, message: "Gagal simpan: " + e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, message: "Action tidak dikenal: " + action }, { status: 400 });
}