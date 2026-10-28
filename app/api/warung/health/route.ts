import { NextRequest, NextResponse } from "next/server";
import { getWarungSessionUser } from "@/lib/warung/session";
import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { okResponse, unauthorizedResponse } from "@/lib/warung/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getWarungSessionUser(request);
  if (!user) return unauthorizedResponse();

  // Cek service account Warung bisa akses Firestore
  let firestoreOk = false;
  let firestoreErr = "";
  try {
    const res = await warungFsFetch(`${warungDatastoreBase()}/warung_settings/store_info`);
    if (res.ok || res.status === 404) {
      firestoreOk = true;
    } else {
      firestoreErr = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    }
  } catch (err: any) {
    firestoreErr = err.message;
  }

  return okResponse({
    session: { id: user.id, role: user.role, name: user.name },
    serviceAccount: { project: "operasional-warung", firestoreOk, firestoreErr },
  });
}