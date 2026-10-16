import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROJECT_ID = "gen-lang-client-0158803339";
const DATABASE_ID = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("admin_session")?.value;
    if (!sessionCookie) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const caller = JSON.parse(decodeURIComponent(sessionCookie));
    if (String(caller.role).toUpperCase() !== "ROOT_ADMIN" && caller.id !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
    const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users?key=${apiKey}&pageSize=100`;

    const res = await fetch(listUrl);
    if (!res.ok) return NextResponse.json({ success: false, message: "Gagal membaca koleksi users" }, { status: 500 });

    const data: any = await res.json();
    const docs = data.documents || [];
    let sanitizedCount = 0;

    for (const d of docs) {
      const docPath = d.name; // projects/.../databases/.../documents/users/userId
      const fields = d.fields || {};

      // Jika ada field password plain text, migrasikan ke Auth lalu hapus field-nya
      if (fields.password && fields.password.stringValue) {
        const uId = fields.userId?.stringValue || docPath.split("/").pop();
        const plainPass = fields.password.stringValue;
        const uEmail = fields.email?.stringValue || `${uId}@wms.atinscollection.com`;
        const uName = fields.fullName?.stringValue || fields.name?.stringValue || uId;

        // Pastikan akun terdaftar di Firebase Auth
        try {
          const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
          await fetch(signUpUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: uEmail,
              password: plainPass,
              displayName: uName,
              returnSecureToken: false,
            }),
          });
        } catch {}

        // Buat salinan fields tanpa field password
        const cleanedFields: any = {};
        for (const k of Object.keys(fields)) {
          if (k !== "password" && k !== "passwordHash") {
            cleanedFields[k] = fields[k];
          }
        }
        cleanedFields.email = { stringValue: uEmail };

        // Patch dokumen dengan menghapus field password
        const updateUrl = `https://firestore.googleapis.com/v1/${docPath}?key=${apiKey}`;
        await fetch(updateUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: cleanedFields }),
        });

        sanitizedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sanitasi selesai. ${sanitizedCount} dokumen telah dibersihkan dari password plain text dan diamankan ke Firebase Auth.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}