const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const cfg = { apiKey: "AIzaSyBZ8Re3MNW5It7lcLYPR0rNitlyumj7O-k", authDomain: "gen-lang-client-0158803339.firebaseapp.com", projectId: "gen-lang-client-0158803339" };
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f");
(async () => {
  const snap = await getDocs(collection(db, "users"));
  const out = [];
  snap.forEach(d => {
    const v = d.data();
    out.push({ docId: d.id, userId: v.userId, username: v.username, email: v.email, role: v.role, active: v.active, hasUID: !!v.uid, hasPassword: !!v.password, hasHash: !!v.passwordHash });
  });
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
