const fs = require("fs");
const { jsPDF } = require("jspdf");

const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4"
});

const pageHeight = doc.internal.pageSize.height;
let y = 20;

function checkPage(needed = 10) {
  if (y + needed >= pageHeight - 15) {
    doc.addPage();
    y = 20;
  }
}

function addTitle(text) {
  checkPage(15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(190, 24, 93); // Pink / Maroon theme
  doc.text(text, 15, y);
  y += 10;
}

function addHeading(text) {
  checkPage(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(text, 15, y);
  y += 7;
}

function addText(text) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const lines = doc.splitTextToSize(text, 180);
  lines.forEach((line) => {
    checkPage(6);
    doc.text(line, 15, y);
    y += 5.5;
  });
  y += 2;
}

function addCodeBlock(code) {
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const lines = code.trim().split("\n");
  lines.forEach((l) => {
    checkPage(5);
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 3.5, 182, 4.8, "F");
    doc.text(l.slice(0, 85), 16, y);
    y += 4.8;
  });
  y += 3;
}

// Header
addTitle("DOKUMENTASI DEPLOYMENT WMS ATIN'S COLLECTION");
addText("Arsitektur Sistem: Next.js (App Router) ke Cloudflare Workers via OpenNext & Firestore");
addText("Tanggal Penyusunan: Oktober 2026 | Environment: Production Live");
y += 3;

// Section 1
addHeading("1. Arsitektur Proyek & Komponen Utama");
addText("- Framework: Next.js (App Router, Webpack engine)");
addText("- Runtime Host: Cloudflare Workers (OpenNext v1.20+)");
addText("- Database: Google Cloud Firestore (Named Database: ai-studio-android-wmsatins-...)");
addText("- Skema Auth: Client-Side Verified Auth (menghindari limitasi V8 serverless Cloudflare)");
y += 2;

// Section 2
addHeading("2. Penanganan Masalah Kritis Cloudflare (V8 Engine)");
addText("A. Bypassing EvalError (new Function):");
addText("Cloudflare Worker melarang dynamic string evaluation. Protobuf.js pada SDK Firestore memicu EvalError saat bootstrapping bundle server. Masalah ini dinetralkan secara otomatis di patch-opennext.js menggunakan closure wrapper (try-catch no-op fallback).");
addText("B. Firestore Client Instance:");
addText("File lib/firebase.ts wajib menggunakan instance resmi getFirestore(app, databaseId) murni tanpa Proxy wrapper agar kompatibel dengan doc() dan collection().");
y += 2;

// Section 3
addHeading("3. Konfigurasi wrangler.jsonc");
addCodeBlock(`{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "admin-portal",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-10-13",
  "compatibility_flags": [ "nodejs_compat" ],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" }
}`);

// Section 4
addHeading("4. Konfigurasi patch-opennext.js");
addText("Skrip patching dieksekusi otomatis pasca build untuk menambal manifest OpenNext dan runtime protobuf codegen:");
addCodeBlock(`const targetCodegen = "Function.apply(null,h).apply(null,i)}return Function(b2)()";
const validSafeCodegen = "(() => { try { return Function.apply(null,h).apply(null,i); } catch(e) { return function(){ return {}; }; } })()}return (() => { try { return Function(b2)(); } catch(e) { return function(){ return {}; }; } })()";
code = code.replace(targetCodegen, validSafeCodegen);`);

// Section 5
addHeading("5. Perintah Build & Deploy Lokal");
addCodeBlock(`npm run build:worker    # Build Next.js bundle & jalankan patch-opennext.js
npm run deploy:worker   # Upload asset dan deploy worker ke Cloudflare
npx wrangler tail admin-portal  # Live log monitoring`);

// Section 6
addHeading("6. Deployment Otomatis via GitHub Actions");
addText("Simpan kredensial Cloudflare di GitHub Secrets (CLOUDFLARE_API_TOKEN & CLOUDFLARE_ACCOUNT_ID), lalu gunakan konfigurasi .github/workflows/deploy.yml berikut:");
addCodeBlock(`name: Deploy WMS to Cloudflare Workers
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run build:worker
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy`);

// Simpan file PDF
const outputPath = "DOKUMENTASI_DEPLOYMENT_WMS.pdf";
fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
console.log("✔ File PDF berhasil dibuat: " + outputPath);