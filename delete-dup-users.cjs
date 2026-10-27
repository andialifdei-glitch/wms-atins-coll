const { initializeApp } = require("firebase/app");
const { getFirestore, doc, deleteDoc } = require("firebase/firestore");
const cfg = { apiKey: "AIzaSyBZ8Re3MNW5It7lcLYPR0rNitlyumj7O-k", authDomain: "gen-lang-client-0158803339.firebaseapp.com", projectId: "gen-lang-client-0158803339" };
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f");
const ids = [
  "admin",
  "admin@wms.atinscollection.com",
  "atins",
  "id.andi",
  "id.atins",
];
(async () => {
  for (const id of ids) {
    try {
      await deleteDoc(doc(db, "users", id));
      console.log("Dihapus:", id);
    } catch (e) {
      console.error("GAGAL hapus:", id, e.message);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
