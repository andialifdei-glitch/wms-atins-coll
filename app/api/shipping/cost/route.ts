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

    // Cari dokumen user dengan docId = userId (parsed.id) dulu, fallback ke parsed.uid
    const candidates = [parsed.id, parsed.uid].filter(Boolean);
    let doc: any = null;
    for (const cand of candidates) {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${encodeURIComponent(cand)}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) { doc = await r.json(); break; }
    }
    if (!doc) return null;

    const isActive = doc.fields?.active?.booleanValue ?? true;
    if (!isActive) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getRajaOngkirKey(): Promise<string> {
  // Baca dari Firestore settings/store_info (via Admin SDK agar tidak kena Firestore Rules)
  try {
    const token = await getGoogleAccessToken(DATABASE_SCOPES);
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_info`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      const j: any = await res.json();
      const val = j.fields?.rajaOngkirApiKey?.stringValue;
      if (val && String(val).trim()) return String(val).trim();
    }
  } catch (err: any) {
    console.error("[shipping/cost] getRajaOngkirKey error:", err.message);
  }
  return "";
}

export async function POST(request: NextRequest) {
  const user = await verifySessionViaAdmin(request);
  if (!user) {
    return NextResponse.json({ success: false, message: "Akses ditolak. Sesi tidak sah." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { origin, destination, weight } = body;

    const originSubdistrict = Number(origin) || 4997;
    const destSubdistrict = Number(destination);
    const finalWeight = Math.max(1000, Number(weight) || 1000);

    if (!destSubdistrict || destSubdistrict <= 0) {
      return NextResponse.json({ success: false, message: "ID destinasi tidak valid." }, { status: 400 });
    }

    const rajaOngkirKey = await getRajaOngkirKey();
    if (!rajaOngkirKey) {
      return NextResponse.json({
        success: false,
        message: "API Key RajaOngkir belum dikonfigurasi di Pengaturan Sistem.",
      }, { status: 400 });
    }

    const supportedCouriers = ["wahana", "lion", "spx"];
    const allRates: any[] = [];

    for (const courier of supportedCouriers) {
      try {
        const form = new URLSearchParams();
        form.append("origin", String(originSubdistrict));
        form.append("destination", String(destSubdistrict));
        form.append("weight", String(finalWeight));
        form.append("courier", courier);

        const res = await fetch(`${KOMERCE_BASE}/calculate/domestic-cost`, {
          method: "POST",
          headers: {
            key: rajaOngkirKey,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: form.toString(),
        });

        if (!res.ok) continue;

        let data: any = {};
        try { data = await res.json(); } catch { continue; }
        const items = Array.isArray(data?.data) ? data.data : [];

        for (const it of items) {
          const courierCode = String(it.code || courier).toUpperCase();
          const sName = String(it.service || "").trim();
          const sDesc = String(it.description || "").trim();
          const costVal = Number(it.cost) || 0;
          const etd = String(it.etd || "1-3");
          if (costVal <= 0) continue;

          // Wahana: HANYA layanan Ekonomis (Komerce: service "Ekonomis")
          if (courierCode === "WAHANA") {
            const haystack = (sName + " " + sDesc).toLowerCase();
            if (!haystack.includes("ekonomis") && !haystack.includes("economy") && !haystack.includes("eco")) continue;
          }
          // Lion: EXCLUDE layanan Bigpack (Komerce: service "BIGPACK")
          if (courierCode === "LION") {
            const haystack = (sName + " " + sDesc).toLowerCase().replace(/\s+/g, "");
            if (haystack.includes("bigpack") || haystack.includes("jumbo")) continue;
          }

          allRates.push({
            courier: courierCode,
            serviceName: `${courierCode} - ${sName || "REG"}`,
            cost: costVal,
            etd: etd.includes("Hari") ? etd : `${etd} Hari`,
          });
        }
      } catch (err: any) {
        console.error(`[shipping/cost] ${courier} exception:`, err.message);
      }
    }

    if (allRates.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Tidak ada tarif tersedia dari kurir. Periksa API Key RajaOngkir atau ID wilayah pengiriman.",
      }, { status: 200 });
    }

    return NextResponse.json({ success: true, rates: allRates });
  } catch (err: any) {
    console.error("[shipping/cost] catch:", err.message);
    return NextResponse.json({ success: false, message: "Gagal menghitung tarif ongkir." }, { status: 500 });
  }
}