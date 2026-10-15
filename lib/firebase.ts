
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "gen-lang-client-0158803339.firebaseapp.com",
  projectId: "gen-lang-client-0158803339",
  storageBucket: "gen-lang-client-0158803339.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const databaseId =
  "ai-studio-android-wmsatins-fb774f20-678f-4586-aeed-4ad08c978b9f";

// Gunakan instance Firestore resmi; jangan mengembalikan objek {} saat SSR.
export const db = getFirestore(app, databaseId);

export { app };
