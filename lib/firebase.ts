import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB04dGkGOXRV8gCOlrWoPKaPm8pUHxmS9w",
  authDomain: "gen-lang-client-0158803339.firebaseapp.com",
  projectId: "gen-lang-client-0158803339",
  storageBucket: "gen-lang-client-0158803339.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ""
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let _dbInstance: Firestore | null = null;

function getDb(): Firestore {
  if (!_dbInstance) {
    _dbInstance = getFirestore(app, "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f");
  }
  return _dbInstance;
}

// Proxy aman: mencegah error getImmediate saat modul pertama kali di-import
export const db: any = new Proxy({}, {
  get(_, prop) {
    if (typeof window === "undefined") {
      return () => ({});
    }
    const target = getDb();
    const val = (target as any)[prop];
    return typeof val === "function" ? val.bind(target) : val;
  }
});