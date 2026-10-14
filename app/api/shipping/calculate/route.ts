export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const BASE_URL = "https://rajaongkir.komerce.id/api/v1";
const DEFAULT_FALLBACK_KEY = "KYr1MRBPb4a4667b8ed8a865DPqsFp5n";
const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

// In-Memory Cache
const cacheRates = new Map<string, { data: any; timestamp: number }>();
const cacheDestinations = new Map<string, { data: any; timestamp: number }>();
const CACHE_RATES_TTL = 30 * 60 * 1000;
const CACHE_DEST_TTL = 24 * 60 * 60 * 1000;

async function getActiveApiKey(): Promise<string> {
  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    "";

  if (!apiKey) return DEFAULT_FALLBACK_KEY;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_info?key=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const val = data?.fields?.rajaOngkirApiKey?.stringValue;
      if (val) return val;
    }
  } catch (err) {
    console.error("Gagal baca rajaOngkirApiKey via REST:", err);
  }
  return DEFAULT_FALLBACK_KEY;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, queryText, originId, destinationId, weightInGrams, courierCode } = body;

    const apiKey = await getActiveApiKey();
    if (!apiKey) {
      return NextResponse.json({ status: "CONFIGURATION_ERROR", message: "API Key RajaOngkir belum dikonfigurasi." }, { status: 400 });
    }

    // 1. CARI DESTINASI
    if (action === "SEARCH_DESTINATION") {
      const cleanQuery = String(queryText || "").trim();
      if (!cleanQuery) {
        return NextResponse.json({ status: "VALIDATION_ERROR", data: [] });
      }

      const cacheKey = cleanQuery.toLowerCase();
      const cached = cacheDestinations.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DEST_TTL) {
        return NextResponse.json({ status: "AVAILABLE", source: "cache", data: cached.data });
      }

      const url = `${BASE_URL}/destination/domestic-destination?search=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(url, {
        headers: { key: apiKey, Accept: "application/json" },
        cache: "no-store",
      });

      const resText = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(resText);
      } catch {
        return NextResponse.json({ status: "API_ERROR", message: `Respons RajaOngkir bukan JSON: ${resText.slice(0, 100)}` }, { status: 502 });
      }

      const rawData = json?.data || [];
      const sanitized = rawData.map((d: any) => ({
        id: Number(d.id),
        label: d.label || `${d.subdistrict_name}, ${d.district_name}, ${d.city_name}`,
        subdistrictName: d.subdistrict_name || "",
        districtName: d.district_name || "",
        cityName: d.city_name || "",
        provinceName: d.province_name || "",
      }));

      cacheDestinations.set(cacheKey, { data: sanitized, timestamp: Date.now() });
      return NextResponse.json({ status: "AVAILABLE", source: "upstream", data: sanitized });
    }

    // 2. HITUNG ONGKIR
    if (action === "CALCULATE_COST") {
      const origin = Number(originId || 4997);
      const dest = Number(destinationId);
      const weight = Math.max(1000, Number(weightInGrams || 1000));
      const courier = String(courierCode || "wahana").toLowerCase();

      if (!dest || dest <= 0) {
        return NextResponse.json({ status: "VALIDATION_ERROR", message: "ID destinasi tidak valid." }, { status: 400 });
      }

      const cacheKey = `cost:${origin}:${dest}:${weight}:${courier}`;
      const cached = cacheRates.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_RATES_TTL) {
        return NextResponse.json({ status: "AVAILABLE", source: "cache", data: cached.data });
      }

      const form = new URLSearchParams();
      form.append("origin", String(origin));
      form.append("destination", String(dest));
      form.append("weight", String(weight));
      form.append("courier", courier);
      form.append("price", "lowest");

      const res = await fetch(`${BASE_URL}/calculate/domestic-cost`, {
        method: "POST",
        headers: {
          key: apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        cache: "no-store",
      });

      const resText = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(resText);
      } catch {
        return NextResponse.json({ status: "API_ERROR", message: `Upstream error: ${resText.slice(0, 100)}` }, { status: 502 });
      }

      const services = json?.data || [];
      const normalizedList = services.map((s: any) => {
        let displayName = s.service || courier.toUpperCase();
        if (courier === "wahana") displayName = "Wahana Ekonomis";
        if (courier === "lion") displayName = s.service === "REGPACK" ? "Lion REGPACK" : `Lion ${s.service}`;
        if (courier === "spx") displayName = s.service?.includes("Standard") ? "SPX Standard" : `SPX ${s.service}`;

        return {
          courier,
          serviceCode: s.service,
          serviceName: displayName,
          cost: Number(s.cost || 0),
          etd: s.etd ? `${String(s.etd).replace(/day/i, "").trim()} hari` : "-",
          description: s.description || "",
        };
      });

      cacheRates.set(cacheKey, { data: normalizedList, timestamp: Date.now() });
      return NextResponse.json({ status: "AVAILABLE", source: "upstream", data: normalizedList });
    }

    return NextResponse.json({ status: "VALIDATION_ERROR", message: "Action tidak dikenali." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ status: "API_ERROR", message: err.message || "Internal server error" }, { status: 500 });
  }
}