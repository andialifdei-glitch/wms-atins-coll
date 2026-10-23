import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Konfigurasi Firebase Project khusus Konter & PPOB (business-control-konter)
const konterFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_KONTER_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_KONTER_FIREBASE_AUTH_DOMAIN || "business-control-konter.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_KONTER_FIREBASE_PROJECT_ID || "business-control-konter",
  storageBucket: process.env.NEXT_PUBLIC_KONTER_FIREBASE_STORAGE_BUCKET || "business-control-konter.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_KONTER_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_KONTER_FIREBASE_APP_ID,
};

// Inisialisasi Firebase App khusus modul Konter agar tidak bentrok dengan instance default WMS
const konterApp = getApps().some((app) => app.name === "konterApp")
  ? getApp("konterApp")
  : initializeApp(konterFirebaseConfig, "konterApp");

// Export instance Firestore untuk database konter
export const konterFirestore = getFirestore(konterApp);
export default konterApp;