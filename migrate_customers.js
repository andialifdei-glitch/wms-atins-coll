const fs = require("fs");
const path = require("path");
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp
} = require("firebase/firestore");

// Baca API key dari .env.local jika ada
let apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const envPath = path.join(process.cwd(), ".env.local");
if (!apiKey && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/NEXT_PUBLIC_FIREBASE_API_KEY=["']?([^"'\r\n]+)/);
  if (match) apiKey = match[1];
}

const firebaseConfig = {
  apiKey: apiKey || "AIzaSyD-dummy",
  authDomain: "ai-studio-android-wmsatins.firebaseapp.com",
  projectId: "gen-lang-client-0158803339",
  storageBucket: "ai-studio-android-wmsatins.appspot.com",
  messagingSenderId: "158803339",
  appId: "1:158803339:web:dummy"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f");

async function runCustomerMigration() {
  console.log("==============================================================");
  console.log("   MEMULAI PROSES AUDIT & MIGRASI ID CUSTOMER (CUST-xxxx)     ");
  console.log("==============================================================\n");

  const snap = await getDocs(collection(db, "customers"));
  if (snap.empty) {
    console.log("Tidak ada data customer yang ditemukan di database.");
    process.exit(0);
  }

  const allCustomers = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  console.log(`Total dokumen customer terdata: ${allCustomers.length}`);

  // 1. Identifikasi nomor tertinggi dari format sah CUST-xxxx
  let maxNum = 0;
  const validCustomers = [];
  const randomIdCustomers = [];

  allCustomers.forEach((c) => {
    const rawId = String(c.customerId || c.docId || "").trim();
    const match = rawId.match(/^CUST-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
      validCustomers.push(c);
    } else {
      randomIdCustomers.push(c);
    }
  });

  console.log(`Dokumen dengan ID sah (CUST-xxxx): ${validCustomers.length} (Tertinggi: CUST-${String(maxNum).padStart(4, "0")})`);
  console.log(`Dokumen dengan ID acak/perlu dimigrasi: ${randomIdCustomers.length}\n`);

  if (randomIdCustomers.length === 0) {
    console.log("✓ Semua ID customer sudah berformat sah CUST-xxxx. Tidak ada data acak.");
    process.exit(0);
  }

  console.log("--- MENGEKSEKUSI MIGRASI ID ACAK KE FORMAT CUST-xxxx ---");
  const report = [];

  for (const oldCust of randomIdCustomers) {
    maxNum += 1;
    const newCustId = `CUST-${String(maxNum).padStart(4, "0")}`;
    const oldId = oldCust.docId;
    const customerName = oldCust.customerName || oldCust.name || "-";

    // Buat dokumen baru dengan ID CUST-xxxx
    await setDoc(doc(db, "customers", newCustId), {
      ...oldCust,
      id: newCustId,
      customerId: newCustId,
      migratedFrom: oldId,
      updatedAt: serverTimestamp()
    });

    // Hapus dokumen lama ber-ID acak
    await deleteDoc(doc(db, "customers", oldId));

    report.push({
      nama: customerName,
      oldId: oldId,
      newId: newCustId
    });

    console.log(`[SUKSES] ${customerName} | Lama: ${oldId} -> Baru: ${newCustId}`);
  }

  // Sinkronkan counter customer
  await setDoc(doc(db, "counters", "customer"), {
    currentNumber: maxNum,
    updatedAt: serverTimestamp()
  }, { merge: true });

  console.log("\n==============================================================");
  console.log("                   LAPORAN HASIL MIGRASI                      ");
  console.log("==============================================================");
  console.log(`Status        : Berhasil`);
  console.log(`Dimigrasi     : ${report.length} dokumen`);
  console.log(`Counter Akhir : CUST-${String(maxNum).padStart(4, "0")}`);
  console.log("Seluruh ID string acak telah dihapus dan diganti ID resmi berurutan.\n");

  process.exit(0);
}

runCustomerMigration().catch((err) => {
  console.error("Gagal menjalankan migrasi:", err);
  process.exit(1);
});
