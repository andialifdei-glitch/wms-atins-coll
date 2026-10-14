const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==================================================");
  console.log("          SYSTEM & DATABASE DEEP AUDIT            ");
  console.log("==================================================");

  let envConfig = {};
  const envFiles = [".dev.vars", ".env.local", ".env"];
  for (const ef of envFiles) {
    const full = path.join(process.cwd(), ef);
    if (fs.existsSync(full)) {
      const txt = fs.readFileSync(full, "utf8");
      txt.split("\n").forEach((line) => {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
          let v = (m[2] || "").trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (!envConfig[m[1]]) envConfig[m[1]] = v;
        }
      });
      console.log(`? Terbaca file env: ${ef}`);
    }
  }

  const projectId = envConfig["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] || envConfig["FIREBASE_PROJECT_ID"];
  const apiKey = envConfig["NEXT_PUBLIC_FIREBASE_API_KEY"] || envConfig["FIREBASE_API_KEY"];

  console.log("\n[1] PARAMETER FIREBASE AKTIF:");
  console.log("- Project ID :", projectId || "(TIDAK DITEMUKAN)");
  console.log("- API Key    :", apiKey ? `Ada (${apiKey.length} karakter)` : "(TIDAK DITEMUKAN)");

  if (!projectId || !apiKey) {
    console.error("FATAL: Project ID atau API Key tidak ditemukan!");
    return;
  }

  console.log("\n[2] PENGUJIAN KONEKSI FIRESTORE REST API:");
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  const testCollections = ["users", "admins", "admin", "accounts", "user", "staff", "employees"];
  let foundAny = false;

  for (const col of testCollections) {
    try {
      const url = `${baseUrl}/${col}?pageSize=10&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
          foundAny = true;
          console.log(`\n? KOLEKSI DITEMUKAN: [${col}] (${data.documents.length} dokumen)`);
          data.documents.forEach((d) => {
            const docId = d.name.split("/").pop();
            const fields = d.fields || {};
            const cleanFields = {};
            for (const [k, v] of Object.entries(fields)) {
              cleanFields[k] = Object.values(v)[0];
            }
            console.log(`  -> ID: "${docId}" | Data:`, JSON.stringify(cleanFields));
          });
        }
      } else {
        const errText = await res.text();
        if (res.status === 404 && errText.includes("database")) {
          console.error(`Gagal menghubungkan ke database (${projectId}): 404 Database Not Found.`);
          break;
        }
      }
    } catch (e) {
      console.error(`Error fetch pada koleksi '${col}':`, e.message);
    }
  }

  if (!foundAny) {
    console.warn("\n? Tidak ada dokumen yang ditemukan pada nama koleksi standar.");
    console.warn("Pastikan Project ID sudah sesuai dengan nama project di console.firebase.google.com");
  }

  console.log("\n==================================================");
  console.log("               AUDIT SELESAI                      ");
  console.log("==================================================");
}

main();
