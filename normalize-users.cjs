const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } = require("firebase/firestore");
const cfg = { apiKey: "AIzaSyBZ8Re3MNW5It7lcLYPR0rNitlyumj7O-k", authDomain: "gen-lang-client-0158803339.firebaseapp.com", projectId: "gen-lang-client-0158803339" };
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f");
(async () => {
  const srcId = "df8SgeHzuZRLENMaIycQEvIIQmt1";
  const dstId = "admin";
  const srcRef = doc(db, "users", srcId);
  const dstRef = doc(db, "users", dstId);
  const snap = await getDoc(srcRef);
  if (!snap.exists()) { console.error("Src tidak ada."); process.exit(1); }
  const data = snap.data();
  // Pastikan docId = userId (konsistensi)
  data.userId = data.userId || dstId;
  data.username = data.username || dstId;
  data.migratedAt = new Date().toISOString();
  const existsDst = await getDoc(dstRef);
  if (existsDst.exists()) { console.error("Dst sudah ada, batal."); process.exit(1); }
  await setDoc(dstRef, data);
  await deleteDoc(srcRef);
  console.log("Dipindah dari", srcId, "ke", dstId);
})().catch(e => { console.error(e); process.exit(1); });
