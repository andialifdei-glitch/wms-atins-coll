import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const konterFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_KONTER_FIREBASE_API_KEY || "AIzaSyBKfhrqvjBRQkqf7dCAmmF995av8roITx4",
  projectId: process.env.NEXT_PUBLIC_KONTER_FIREBASE_PROJECT_ID || "business-control-konter",
  authDomain: "business-control-konter.firebaseapp.com",
  storageBucket: "business-control-konter.appspot.com",
};

const konterApp = getApps().some((a) => a.name === "KONTER_APP")
  ? getApp("KONTER_APP")
  : initializeApp(konterFirebaseConfig, "KONTER_APP");

export const konterFirestore = getFirestore(konterApp);
export default konterFirestore;