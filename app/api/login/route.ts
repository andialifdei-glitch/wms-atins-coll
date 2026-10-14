import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ROOT_ID = "admin";
const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!userId || !password) {
      return NextResponse.json(
        { success: false, message: "ID dan Password wajib diisi" },
        { status: 400 }
      );
    }

    const inputHash = await sha256Hex(password);
    const rootHash = await sha256Hex("rootadmin");

    let authenticatedUser: { id: string; role: string; name: string } | null = null;

    if (userId === ROOT_ID && inputHash === rootHash) {
      authenticatedUser = { id: "admin", role: "Admin", name: "Super Admin" };
    } else {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents:runQuery?key=${apiKey}`;

      try {
        const res = await fetch(queryUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "portal_users" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "username" },
                  op: "EQUAL",
                  value: { stringValue: userId },
                },
              },
              limit: 1,
            },
          }),
        });

        if (res.ok) {
          const list: any[] = await res.json();
          const found = list.find((d) => d.document && d.document.fields);
          if (found) {
            const fields = found.document.fields;
            const dbHash = fields.passwordHash?.stringValue || fields.password?.stringValue;
            if (dbHash === inputHash) {
              authenticatedUser = {
                id: userId,
                role: fields.role?.stringValue || "Staff",
                name: fields.fullName?.stringValue || userId,
              };
            }
          }
        }
      } catch (err) {
        console.error("Firestore user query error:", err);
      }
    }

    if (!authenticatedUser) {
      return NextResponse.json(
        { success: false, message: "ID atau Password salah" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: authenticatedUser,
    });

    response.cookies.set({
      name: "admin_session",
      value: JSON.stringify(authenticatedUser),
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error("Login Handler Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}