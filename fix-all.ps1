$root = $PWD
Write-Host "=== MEMULAI PERBAIKAN MENYELURUH ===" -ForegroundColor Cyan

# 1. Hentikan sisa proses Node yang mengunci file .next
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host "[1/5] Proses node lama dihentikan." -ForegroundColor Green

# 2. Periksa dan normalisasi export pada app/DashboardClient.tsx
$dashClientPath = "$root\app\DashboardClient.tsx"
if (Test-Path $dashClientPath) {
    $dcContent = [System.IO.File]::ReadAllText($dashClientPath, [System.Text.Encoding]::UTF8)
    if (-not $dcContent.Contains("export default")) {
        $dcContent += "`nexport default DashboardClient;`n"
        [System.IO.File]::WriteAllText($dashClientPath, $dcContent, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "[2/5] app/DashboardClient.tsx: export default dipastikan tersedia." -ForegroundColor Green
    } else {
        Write-Host "[2/5] app/DashboardClient.tsx: export default sudah ada." -ForegroundColor Green
    }
} else {
    Write-Host "[2/5] File app/DashboardClient.tsx tidak ditemukan di root app/, melewati." -ForegroundColor Gray
}

# 3. Pastikan lib/firebase-konter.ts valid mengarah ke business-control-konter
$konterFbCode = @'
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
