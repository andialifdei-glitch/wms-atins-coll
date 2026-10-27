const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const fs = require("fs");
const cfg = { apiKey: "AIzaSyBZ8Re3MNW5It7lcLYPR0rNitlyumj7O-k", authDomain: "gen-lang-client-0158803339.firebaseapp.com", projectId: "gen-lang-client-0158803339" };
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f");
(async () => {
  const snap = await getDocs(collection(db, "users"));
  const out = [];
  snap.forEach(d => out.push({ docId: d.id, data: d.data() }));
  const file = `backup-users-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Backup:", file, `(${out.length} dokumen)`);
})().catch(e => { console.error(e); process.exit(1); });
