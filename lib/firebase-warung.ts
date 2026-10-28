import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const WARUNG_APP_NAME = "warung-operational";

const warungFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_WARUNG_API_KEY || "AIzaSyCn6Bs0b37KGtznp9DHkk7C8srUu7vUC0",
  authDomain: process.env.NEXT_PUBLIC_WARUNG_AUTH_DOMAIN || "operasional-warung.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_WARUNG_PROJECT_ID || "operasional-warung",
  storageBucket: process.env.NEXT_PUBLIC_WARUNG_STORAGE_BUCKET || "operasional-warung.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_WARUNG_MESSAGING_SENDER_ID || "481322113923",
  appId: process.env.NEXT_PUBLIC_WARUNG_APP_ID || "1:481322113923:web:ede380aa7355989f1234b6",
};

export const warungApp =
  typeof window === "undefined"
    ? null
    : getApps().some((a) => a.name === WARUNG_APP_NAME)
    ? getApp(WARUNG_APP_NAME)
    : initializeApp(warungFirebaseConfig, WARUNG_APP_NAME);

export const warungDb = typeof window === "undefined" ? null : getFirestore(warungApp!);
export const warungAuth = typeof window === "undefined" ? null : getAuth(warungApp!);