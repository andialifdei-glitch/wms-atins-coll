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
    for (const cand of [parsed.id, parsed.uid].filter(Boolean)) {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${encodeURIComponent(cand)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.ok) {
        const doc: any = await r.json();
        if ((doc.fields?.active?.booleanValue ?? true) === false) return null;
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getRajaOngkirKey(): Promise<string> {
  try {
    const token = await getGoogleAccessToken(DATABASE_SCOPES);
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_info`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (r.ok) {
      const j: any = await r.json();
      const val = j.fields?.rajaOngkirApiKey?.stringValue;
      if (val && String(val).trim()) return String(val).trim();
    }
  } catch {}
  return "";
}

async function komerceSearch(apiKey: string, query: string): Promise<any[]> {
  if (!query || !query.trim()) return [];
  try {
    const url = `${KOMERCE_BASE}/destination/domestic-destination?search=${encodeURIComponent(query.trim())}&limit=30`;
    const res = await fetch(url, { headers: { key: apiKey, Accept: "application/json" } });
    if (!res.ok) return [];
    const json: any = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

// Skor kecocokan antar hasil Komerce dan input user
function scoreMatch(item: any, q: { villageName: string; districtName: string; regencyName: string; provinceName: string }): number {
  const low = (s: string) => String(s || "").toLowerCase()
    .replace(/^(kabupaten|kab\.|kota|kotamadya)\s+/i, "")
    .trim();
  const sub = low(item?.subdistrict_name || "");
  const dis = low(item?.district_name || "");
  const city = low(item?.city_name || "");
  const prov = low(item?.province_name || "");

  const qVil = low(q.villageName);
  const qDis = low(q.districtName);
  const qCity = low(q.regencyName);
  const qProv = low(q.provinceName);

  let score = 0;
  if (qVil && sub === qVil) score += 100;
  else if (qVil && (sub.includes(qVil) || qVil.includes(sub))) score += 50;
  if (qDis && dis === qDis) score += 30;
  if (qCity && city === qCity) score += 20;
  else if (qCity && (city.includes(qCity) || qCity.includes(city))) score += 10;
  if (qProv && prov === qProv) score += 15;
  return score;
}

export async function POST(request: NextRequest) {
  const user = await verifySessionViaAdmin(request);
  if (!user) return NextResponse.json({ success: false, message: "Akses ditolak. Sesi tidak sah." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const villageName = String(body.villageName || "").trim();
  const districtName = String(body.districtName || "").trim();
  const regencyName = String(body.regencyName || "").trim();
  const provinceName = String(body.provinceName || "").trim();

  if (!villageName && !regencyName) {
    return NextResponse.json({ success: false, message: "Nama wilayah kosong." }, { status: 400 });
  }

  const apiKey = await getRajaOngkirKey();
  if (!apiKey) return NextResponse.json({ success: false, message: "API Key RajaOngkir belum diset." }, { status: 400 });

  const queries: string[] = [];
  if (villageName && districtName) queries.push(`${villageName} ${districtName}`);
  if (villageName) queries.push(villageName);
  if (districtName && regencyName) queries.push(`${districtName} ${regencyName}`);
  if (regencyName) queries.push(regencyName);

  const seen = new Set<any>();
  let bestMatch: any = null;
  let bestScore = 0;

  for (const q of queries) {
    const results = await komerceSearch(apiKey, q);
    for (const item of results) {
      const id = Number(item.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const score = scoreMatch(item, { villageName, districtName, regencyName, provinceName });
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
    if (bestScore >= 100) break; // sudah pasti exact village
  }

  if (!bestMatch) {
    return NextResponse.json({
      success: false,
      message: "Wilayah tidak ditemukan di Komerce. Coba pilih wilayah yang lebih spesifik.",
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      destinationId: Number(bestMatch.id),
      label: bestMatch.label,
      score: bestScore,
      postcode: bestMatch.postal_code || "",
    },
  });
}