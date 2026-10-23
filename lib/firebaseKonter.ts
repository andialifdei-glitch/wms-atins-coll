import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const konterFirebaseConfig = {
  apiKey: "AIzaSyBKfhrqvjBRQkqf7dCAmmF995av8roITx4",
  authDomain: "business-control-konter.firebaseapp.com",
  projectId: "business-control-konter",
  storageBucket: "business-control-konter.firebasestorage.app",
  messagingSenderId: "1058397851047",
  appId: "1:1058397851047:web:c6b20f077f46daeb9d3a82",
  measurementId: "G-3PFLRXDQWD"
};

// Gunakan named app agar tidak bentrok dengan instance Firebase WMS utama
const konterApp = getApps().find(app => app.name === "konterApp") 
  || initializeApp(konterFirebaseConfig, "konterApp");

export const konterFirestore = getFirestore(konterApp);
export default konterApp;
