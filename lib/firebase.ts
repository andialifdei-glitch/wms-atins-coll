import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ==============================================================
// 1. INSTANCE DATABASE WMS & LOGIN USERS (gen-lang-client-0158803339)
// ==============================================================
const wmsFirebaseConfig = {
  apiKey: "AIzaSyBZ8Re3MNW5It7lcLYPR0rNitlyumj7O-k",
  authDomain: "gen-lang-client-0158803339.firebaseapp.com",
  projectId: "gen-lang-client-0158803339",
  storageBucket: "gen-lang-client-0158803339.firebasestorage.app",
  messagingSenderId: "165410314721",
  appId: "1:165410314721:android:69031023b8527c5e66daa0",
};

export const wmsApp = getApps().some((a) => a.name === "[DEFAULT]")
  ? getApp("[DEFAULT]")
  : initializeApp(wmsFirebaseConfig, "[DEFAULT]");

export const auth = getAuth(wmsApp);

// Database Named khusus WMS & Users
const wmsNamedDatabaseId = "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";
export const db = getFirestore(wmsApp, wmsNamedDatabaseId);
export const userDb = db; // Alias untuk login/users

// ==============================================================
// 2. INSTANCE DATABASE OPERASIONAL KONTER (business-control-konter)
// JANGAN DIUBAH KARENA SUDAH BERJALAN NORMAL
// ==============================================================
const konterFirebaseConfig = {
  apiKey: "AIzaSyBKfhrqvjBRQkqf7dCAmmF995av8roITx4",
  authDomain: "business-control-konter.firebaseapp.com",
  projectId: "business-control-konter",
  storageBucket: "business-control-konter.firebasestorage.app",
  messagingSenderId: "1058397851047",
  appId: "1:1058397851047:web:c6b20f077f46daeb9d3a82",
};

export const konterApp = getApps().some((a) => a.name === "konter-operational")
  ? getApp("konter-operational")
  : initializeApp(konterFirebaseConfig, "konter-operational");

// Firestore Operasional Konter
export const konterFirestore = getFirestore(konterApp);

// Fallback exports
export const app = wmsApp;