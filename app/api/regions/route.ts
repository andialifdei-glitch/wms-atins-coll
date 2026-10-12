import { NextResponse } from "next/server";

const BASE_URL = "https://www.emsifa.com/api-wilayah-indonesia/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // provinces, regencies, districts, villages
  const code = searchParams.get("code");

  let url = `${BASE_URL}/provinces.json`;
  if (type === "regencies" && code) {
    url = `${BASE_URL}/regencies/${code}.json`;
  } else if (type === "districts" && code) {
    url = `${BASE_URL}/districts/${code}.json`;
  } else if (type === "villages" && code) {
    url = `${BASE_URL}/villages/${code}.json`;
  }

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal memuat wilayah" }, { status: 500 });
  }
}