import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { origin, destination, weight } = body;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
    // Ambil API Key Rajaongkir Komerce dari Firestore store_info
    let rajaOngkirKey = "";
    try {
      const PROJECT_ID = "gen-lang-client-0158803339";
      const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";
      const settingsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/settings/store_info?key=${apiKey}`);
      if (settingsRes.ok) {
        const sJson = await settingsRes.json();
        rajaOngkirKey = sJson.fields?.rajaOngkirApiKey?.stringValue || "";
      }
    } catch {}

    const originSubdistrict = origin || 4997; // Banjaran Default
    const destSubdistrict = destination || 4997;
    const finalWeight = Math.max(1000, Number(weight) || 1000);

    // Daftar kurir resmi yang didukung: Wahana, Lion Parcel, SPX
    const supportedCouriers = ["wahana", "lion", "spx"];
    const allRates: any[] = [];

    if (rajaOngkirKey) {
      for (const courier of supportedCouriers) {
        try {
          const res = await fetch("https://pro.rajaongkir.com/api/cost", {
            method: "POST",
            headers: {
              "key": rajaOngkirKey,
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              origin: String(originSubdistrict),
              originType: "subdistrict",
              destination: String(destSubdistrict),
              destinationType: "subdistrict",
              weight: String(finalWeight),
              courier: courier,
            }),
          });

          if (res.ok) {
            const data: any = await res.json();
            const results = data.rajaongkir?.results || [];
            for (const r of results) {
              const courierCode = (r.code || courier).toUpperCase();
              for (const c of r.costs || []) {
                allRates.push({
                  courier: courierCode,
                  serviceName: `${courierCode} - ${c.service}`,
                  cost: c.cost?.[0]?.value || 0,
                  etd: c.cost?.[0]?.etd ? `${c.cost[0].etd} Hari` : "1-3 Hari",
                });
              }
            }
          }
        } catch {}
      }
    }

    // Jika API belum dikonfigurasi / gagal koneksi, sediakan standar estimasi kurir
    if (allRates.length === 0) {
      allRates.push(
        { courier: "WAHANA", serviceName: "WAHANA - Normal", cost: 10000, etd: "2-3 Hari" },
        { courier: "LION", serviceName: "LION - REGPACK", cost: 13000, etd: "1-2 Hari" },
        { courier: "SPX", serviceName: "SPX - Standard", cost: 11000, etd: "1-2 Hari" }
      );
    }

    return NextResponse.json({
      success: true,
      rates: allRates,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Gagal cek ongkir" }, { status: 500 });
  }
}