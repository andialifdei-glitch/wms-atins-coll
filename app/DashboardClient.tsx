"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { formatRupiah, buildWhatsAppMessage } from "@/lib/formatters";
import ProductModal from "@/components/modals/ProductModal";
import SupplierModal from "@/components/modals/SupplierModal";
import StockAdjustmentModal from "@/components/modals/StockAdjustmentModal";
import StockOpnameModal from "@/components/modals/StockOpnameModal";
import SalesOrderModal from "@/components/modals/SalesOrderModal";
import CreatePurchaseOrderModal from "@/components/modals/CreatePurchaseOrderModal";
import NotificationBell from "@/components/notifications/NotificationBell";

type MainTab = "dashboard" | "sales" | "inventory" | "purchase" | "reports" | "settings" | "human";

interface RegionItem {
  id: string;
  name: string;
}

function generateValidPdfBlob(title: string, headers: string[], rows: any[][]): Blob {
  const sanitize = (text: string) => String(text || "-").replace(/[\\()]/g, " ");

  let contentStream = "BT\n/F1 14 Tf\n40 790 Td\n(" + sanitize(title) + ") Tj\nET\n";
  contentStream += "BT\n/F1 8 Tf\n40 775 Td\n(Dicetak: " + sanitize(new Date().toLocaleString("id-ID")) + ") Tj\nET\n";

  let y = 750;
  contentStream += "BT\n/F1 9 Tf\n";
  let x = 40;
  headers.forEach((h) => {
    contentStream += `${x} ${y} Td\n(${sanitize(h)}) Tj\n${-x} ${-y} Td\n`;
    x += 95;
  });
  contentStream += "ET\n";

  y -= 15;
  contentStream += "BT\n/F1 8 Tf\n";
  rows.slice(0, 48).forEach((row) => {
    let rx = 40;
    row.forEach((cell) => {
      contentStream += `${rx} ${y} Td\n(${sanitize(String(cell))}) Tj\n${-rx} ${-y} Td\n`;
      rx += 95;
    });
    y -= 13;
  });
  contentStream += "ET\n";

  const streamLen = contentStream.length;
  const pdfString =
`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLen} >>
stream
${contentStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000234 00000 n 
0000000${String(300 + streamLen).padStart(3, "0")} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${380 + streamLen}
%%EOF`;

  return new Blob([pdfString], { type: "application/pdf" });
}

function downloadPdf(title: string, filename: string, headers: string[], rows: any[][]) {
  const blob = generateValidPdfBlob(title, headers, rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadExcel(docNo: string, filename: string, headers: string[], rows: any[][]) {
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${docNo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getInitialUserSession() {
  if (typeof window === "undefined") {
    return { id: "", role: "", name: "", username: "" };
  }
  try {
    const match = document.cookie.split("; ").find((row) => row.startsWith("admin_session="));
    if (match) {
      const raw = match.split("=")[1];
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (parsed) {
        return {
          id: parsed.id || parsed.userId || parsed.uid || "",
          role: parsed.role || "",
          name: parsed.name || parsed.fullName || "",
          username: parsed.id || parsed.userId || "",
        };
      }
    }
  } catch {}

  try {
    const local = localStorage.getItem("wms_user_session");
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed) {
        return {
          id: parsed.id || parsed.userId || parsed.uid || "",
          role: parsed.role || "",
          name: parsed.name || parsed.fullName || "",
          username: parsed.id || parsed.userId || "",
        };
      }
    }
  } catch {}

  return { id: "", role: "", name: "", username: "" };
}

export default function DashboardClient() {
  const router = useRouter();

  // Navigation State
  const [currentTab, setCurrentTab] = useState<MainTab>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [salesSubTab, setSalesSubTab] = useState<"so" | "do">("so");
  const [invSubTab, setInvSubTab] = useState<string>("products");
  const [poSubTab, setPoSubTab] = useState<string>("po_list");
  const [reportSubTab, setReportSubTab] = useState<"so" | "do" | "sales_item_day" | "sales_summary_day" | "customer" | "stock">("so");
  const [humanSubTab, setHumanSubTab] = useState<"staff" | "suppliers" | "customers" | "families">("staff");

  // Master Data State
  const [products, setProducts] = useState<any[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [receivings, setReceivings] = useState<any[]>([]);
  const [stockOpnames, setStockOpnames] = useState<any[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<any[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter State
  const [soSearchQuery, setSoSearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [soStatusFilter, setSoStatusFilter] = useState<string>("ALL");
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Authenticated User Session
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string; username?: string }>(getInitialUserSession);

  // Store Configuration
  const [storeSettings, setStoreSettings] = useState({
    storeName: "Atin's Collection",
    storePhone: "0899-7884-435",
    storeAddress: "Banjaran, Kab. Bandung, Jawa Barat",
    detailAddress: "",
    provinceCode: "",
    provinceName: "",
    regencyCode: "",
    regencyName: "",
    districtCode: "",
    districtName: "",
    villageCode: "",
    villageName: "",
    postalCode: "",
    labelSize: "58mm",
    rajaOngkirApiKey: "",
    defaultOriginId: 4997,
    btPrinterDeviceName: "",
  });

  const [savedSettings, setSavedSettings] = useState<any>(null);

  // Alert Modal State
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const [isSessionTimeoutOpen, setIsSessionTimeoutOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // SO Detail & Operations
  const [selectedSoDetail, setSelectedSoDetail] = useState<any | null>(null);
  const [isSoDetailModalOpen, setIsSoDetailModalOpen] = useState(false);
  const [isEditExpeditionModalOpen, setIsEditExpeditionModalOpen] = useState(false);
  const [targetProcessingSo, setTargetProcessingSo] = useState<any | null>(null);
  const [soCancelTarget, setSoCancelTarget] = useState<any | null>(null);
  const [soCancelReason, setSoCancelReason] = useState("");
  const [isSoCancelConfirmOpen, setIsSoCancelConfirmOpen] = useState(false);

  // DO Actions
  const [btPrintDevice, setBtPrintDevice] = useState<any | null>(null);
  const [btStatus, setBtStatus] = useState<string>("Belum Terhubung");

  // SOP Review & Posting
  const [reviewSopTarget, setReviewSopTarget] = useState<any | null>(null);
  const [isSopReviewModalOpen, setIsSopReviewModalOpen] = useState(false);
  const [reviewItemsData, setReviewItemsData] = useState<any[]>([]);

  // Receiving Process & PO Selector Modal
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [selectedPoForReceiving, setSelectedPoForReceiving] = useState<any | null>(null);
  const [receivingInputs, setReceivingInputs] = useState<Record<string, number>>({});
  const [isSelectPoForReceivingOpen, setIsSelectPoForReceivingOpen] = useState(false);

  // Customer Form State
  const [customerModalMode, setCustomerModalMode] = useState<"create" | "edit">("create");
  const [customerForm, setCustomerForm] = useState({
    customerId: "",
    customerName: "",
    phone: "",
    email: "",
    provinceCode: "",
    provinceName: "",
    regencyCode: "",
    regencyName: "",
    districtCode: "",
    districtName: "",
    villageCode: "",
    villageName: "",
    detailAddress: "",
    postalCode: "",
  });
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [custRegencies, setCustRegencies] = useState<RegionItem[]>([]);
  const [custDistricts, setCustDistricts] = useState<RegionItem[]>([]);
  const [custVillages, setCustVillages] = useState<RegionItem[]>([]);
  const [loadingCustRegion, setLoadingCustRegion] = useState(false);

  // Staff Form State
  const [staffModalMode, setStaffModalMode] = useState<"create" | "edit">("create");
  const [staffForm, setStaffForm] = useState({ staffId: "", fullName: "", userId: "", password: "" });
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Modals & Forms
    // Family CRUD State
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [familyModalMode, setFamilyModalMode] = useState<"create" | "edit">("create");
  const [familyForm, setFamilyForm] = useState({ familyCode: "", familyName: "" });

  // Audit Primary Key State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditReport, setAuditReport] = useState<any[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productFormData, setProductFormData] = useState<any>({
    sku: "",
    itemName: "",
    familyCode: "",
    weightInGrams: 0,
    active: true,
    purchasingPrice: 0,
    netPrice: 0,
    initialStock: 0,
    supplierId: "",
    supplierName: "",
  });
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [isInitSopModalOpen, setIsInitSopModalOpen] = useState(false);
  const [isSoModalOpen, setIsSoModalOpen] = useState(false);
  const [editingSoId, setEditingSoId] = useState<string | null>(null);
  const [soModalInitCustomer, setSoModalInitCustomer] = useState<any | null>(null);
  const [soModalInitItems, setSoModalInitItems] = useState<any[]>([]);
  const [soModalInitRates, setSoModalInitRates] = useState<any[]>([]);
  const [soModalInitCost, setSoModalInitCost] = useState<number>(0);
  const [soModalInitCourier, setSoModalInitCourier] = useState<string>("KURIR_TOKO");
  const [soModalInitService, setSoModalInitService] = useState<string>("Kurir Toko (Tarif Manual)");
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);

  // Kartu Mutasi Detail Modal
  const [selectedProductLedger, setSelectedProductLedger] = useState<any | null>(null);

  // Geographic state toko
  const [provinces, setProvinces] = useState<RegionItem[]>([]);
  const [regencies, setRegencies] = useState<RegionItem[]>([]);
  const [districts, setDistricts] = useState<RegionItem[]>([]);
  const [villages, setVillages] = useState<RegionItem[]>([]);
  const [loadingRegion, setLoadingRegion] = useState(false);

  // API Key State dengan validasi Uji Dulu Baru Simpan
  const [inputApiKey, setInputApiKey] = useState("");
  const [apiKeyTestedSuccess, setApiKeyTestedSuccess] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsSessionTimeoutOpen(true), 5 * 60 * 1000);
  };

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handleActivity = () => resetIdleTimer();
    events.forEach((ev) => window.addEventListener(ev, handleActivity));
    resetIdleTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const handleSessionTimeoutLogout = () => {
    setIsSessionTimeoutOpen(false);
    document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    localStorage.removeItem("wms_user_session");
    sessionStorage.removeItem("wms_visited_session");
    router.push("/login");
  };

  useEffect(() => {
    const session = getInitialUserSession();
    if (session.name || session.id) {
      setCurrentUser(session);
    } else {
      router.push("/login");
    }
  }, [router]);

  const isRootAdmin = useMemo(() => {
    const roleClean = String(currentUser.role || "").trim().toUpperCase();
    const userClean = String(currentUser.username || currentUser.id || "").trim().toLowerCase();
    return userClean === "admin" || userClean.includes("admin@") || roleClean.includes("ROOT");
  }, [currentUser]);

  const isStaff = useMemo(() => {
    const roleClean = String(currentUser.role || "").trim().toUpperCase();
    return roleClean.includes("STAFF");
  }, [currentUser]);

  const showAlert = (message: string, title = "Informasi") => {
    setAlertModal({ isOpen: true, title, message });
  };

      // Handler Eksekusi Stock Adjustment ke Firestore
  async function handleExecuteStockAdjustment(payload: any) {
    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];

      const sku = String(payload.sku || payload.itemCode || payload.selectedSku || "").trim();
      const adjType = String(payload.adjustmentType || payload.type || "INCREASE").toUpperCase();
      const qty = Math.abs(Number(payload.adjustmentQty ?? payload.qty ?? 0));
      const reason = String(payload.reason || "-").trim();

      if (!sku || qty <= 0) {
        throw new Error("SKU dan kuantitas penyesuaian harus valid!");
      }

      const counterRef = doc(db, "counters", "stock_adjustment");
      const prodRef = doc(db, "products", sku);

      const generatedAdjId = await runTransaction(db, async (tx) => {
        // --- FASE 1: READ SEMUA DOKUMEN ---
        const [cSnap, pSnap] = await Promise.all([
          tx.get(counterRef),
          tx.get(prodRef),
        ]);

        if (!pSnap.exists()) {
          throw new Error(`Produk dengan SKU [${sku}] tidak ditemukan!`);
        }

        const pData = pSnap.data();
        const currentStock = Number(pData.stock || 0);
        let newStock = currentStock;

        if (adjType === "INCREASE") {
          newStock = currentStock + qty;
        } else if (adjType === "DECREASE") {
          if (currentStock < qty) {
            throw new Error(`Stok saat ini (${currentStock} pcs) tidak mencukupi untuk pengurangan ${qty} pcs!`);
          }
          newStock = currentStock - qty;
        }

        const currCounter = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
        const nextCounter = currCounter + 1;
        const adjDocId = `ADJ-${dateStr}-${String(nextCounter).padStart(5, "0")}`;

        // --- FASE 2: WRITE SEMUA DOKUMEN ---
        tx.set(counterRef, { currentNumber: nextCounter, updatedAt: serverTimestamp() }, { merge: true });

        tx.update(prodRef, {
          stock: newStock,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name || currentUser.id,
        });

        const adjDocRef = doc(db, "stock_adjustments", adjDocId);
        tx.set(adjDocRef, {
          adjustmentId: adjDocId,
          documentNo: adjDocId,
          date: displayDate,
          sku: sku,
          itemName: pData.itemName || payload.itemName || "-",
          adjustmentType: adjType,
          adjustmentQty: qty,
          currentStock: currentStock,
          newStock: newStock,
          reason: reason,
          user: currentUser.name || currentUser.id,
          createdAt: serverTimestamp(),
        });

        const mvRef = doc(collection(db, "stock_movements"));
        tx.set(mvRef, {
          movementId: mvRef.id,
          date: displayDate,
          itemCode: sku,
          itemNameSnapshot: pData.itemName || payload.itemName || "-",
          type: "ADJUSTMENT",
          referenceId: adjDocId,
          qtyIn: adjType === "INCREASE" ? qty : 0,
          qtyOut: adjType === "DECREASE" ? qty : 0,
          previousStock: currentStock,
          newStock: newStock,
          reason: `Stock Adjustment (${adjDocId}): ${reason}`,
          user: currentUser.name || currentUser.id,
          timestamp: serverTimestamp(),
        });

        return adjDocId;
      });

      showAlert(`Stock Adjustment [${generatedAdjId}] berhasil diproses dan saldo fisik telah diperbarui.`);
      setIsAdjModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal memproses Stock Adjustment.");
    } finally {
      setLoading(false);
    }
  }

  // Handler Inisialisasi Stock Opname Baru ke Firestore
  async function handleConfirmInitStockOpname(payload: any) {
    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];

      const counterRef = doc(db, "counters", "stock_opname");

      const generatedSopId = await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(counterRef);
        const currCounter = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
        const nextCounter = currCounter + 1;
        const sopDocId = `SOP-${dateStr}-${String(nextCounter).padStart(5, "0")}`;

        // Persiapkan daftar item snapshot stok sistem terkini
        let targetProducts = products.filter((p) => p.active !== false);
        if (payload?.familyCode && payload.familyCode !== "ALL") {
          targetProducts = targetProducts.filter((p) => p.familyCode === payload.familyCode);
        }

        const sopItems = targetProducts.map((p) => ({
          sku: p.sku,
          skuCode: p.sku,
          skuId: p.sku,
          itemName: p.itemName,
          systemQtySnapshot: Number(p.stock || 0),
          physicalQty: Number(p.stock || 0), // Inisialisasi awal sama dengan sistem
          countedBy: currentUser.name || currentUser.id || "Auditor",
        }));

        tx.set(counterRef, { currentNumber: nextCounter, updatedAt: serverTimestamp() }, { merge: true });

        const sopDocRef = doc(db, "stock_opnames", sopDocId);
        tx.set(sopDocRef, {
          sopId: sopDocId,
          documentNo: sopDocId,
          opnameDate: displayDate,
          totalSku: sopItems.length,
          items: sopItems,
          status: "COUNTING_COMPLETED", // Siap untuk tahap review dan penyesuaian fisik
          familyCode: payload?.familyCode || "ALL",
          initiatedBy: currentUser.name || currentUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return sopDocId;
      });

      showAlert(`Inisialisasi Stock Opname [${generatedSopId}] berhasil dibuat. Dokumen siap direview.`);
      setIsInitSopModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal membuat inisialisasi Stock Opname.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePurchaseOrder(payload: any) {
    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];

      const counterRef = doc(db, "counters", "purchase_order");
      const generatedPoId = await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(counterRef);
        const curr = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
        const next = curr + 1;
        const newPoId = `PO-${dateStr}-${String(next).padStart(5, "0")}`;

        tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() }, { merge: true });

        const poDocRef = doc(db, "purchase_orders", newPoId);
        tx.set(poDocRef, {
          poId: newPoId,
          documentNo: newPoId,
          poDate: displayDate,
          supplierId: payload.supplierId || "",
          supplier: payload.supplier,
          supplierPhone: payload.supplierPhone || "-",
          supplierAddress: payload.supplierAddress || "-",
          items: payload.items.map((it: any) => ({
            sku: it.sku,
            itemName: it.itemName,
            qty: Number(it.qty) || 0,
            receivedQty: 0,
            purchasingPrice: Number(it.purchasingPrice) || 0,
            subtotal: Number(it.subtotal) || 0,
          })),
          total: Number(payload.total) || 0,
          notes: payload.notes || "",
          status: "OPEN",
          createdBy: currentUser.name || currentUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return newPoId;
      });

      showAlert(`Purchase Order [${generatedPoId}] berhasil diterbitkan dan tersimpan di database.`);
      setIsCreatePoModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menerbitkan Purchase Order.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

    // --- FUNGSI CRUD FAMILY PRODUK (FAM-xxx) ---
    // --- FUNGSI CRUD STAF GUDANG ---
  function getNextStaffId() {
    let maxNum = 0;
    usersList.forEach((u) => {
      const sid = String(u.staffId || u.id || "").trim();
      const match = sid.match(/ST-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `ST-${String(maxNum + 1).padStart(2, "0")}`;
  }

  function handleOpenCreateStaff() {
    const nextId = getNextStaffId();
    setStaffForm({
      staffId: nextId,
      fullName: "",
      userId: "",
      password: "",
      role: "STAFF_GUDANG",
    } as any);
    setStaffModalMode("create");
    setIsStaffModalOpen(true);
  }

  function handleOpenEditStaff(u: any) {
    setStaffForm({
      staffId: u.staffId || u.id,
      fullName: u.fullName || u.name || "",
      userId: u.userId || u.username || u.id,
      password: "", // Kosongkan password saat edit jika tidak ingin diubah
      role: u.role || "STAFF_GUDANG",
    } as any);
    setStaffModalMode("edit");
    setIsStaffModalOpen(true);
  }

  function handleCloseStaffModal() {
    setStaffForm({
      staffId: "",
      fullName: "",
      userId: "",
      password: "",
      role: "STAFF_GUDANG",
    } as any);
    setIsStaffModalOpen(false);
  }

  async function handleSaveStaff(e: React.FormEvent) {
    e.preventDefault();
    const sId = staffForm.staffId.trim();
    const uId = staffForm.userId.trim().toLowerCase();
    const fName = staffForm.fullName.trim();
    const sRole = (staffForm as any).role || "STAFF_GUDANG";
    const pass = staffForm.password.trim();

    if (!uId || !fName) {
      return showAlert("User ID dan Nama Lengkap staf wajib diisi!");
    }

    if (staffModalMode === "create" && !pass) {
      return showAlert("Password wajib diisi untuk pembuatan akun staf baru!");
    }

    try {
      setLoading(true);
      const userRef = doc(db, "users", uId);

      if (staffModalMode === "create") {
        const existing = usersList.find((u) => (u.userId || u.id || "").toLowerCase() === uId);
        if (existing) {
          return showAlert(`User ID [${uId}] sudah terdaftar! Gunakan User ID lain.`);
        }

        // 1. Daftarkan akun di Firebase Auth REST API
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
        const staffEmail = `${uId}@atins-collection.local`;

        try {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: staffEmail,
              password: pass,
              returnSecureToken: false,
            }),
          });
        } catch {}

        // 2. Simpan ke Firestore koleksi users
        await setDoc(userRef, {
          id: uId,
          userId: uId,
          staffId: sId,
          fullName: fName,
          name: fName,
          role: sRole,
          createdAt: serverTimestamp(),
          createdBy: currentUser.name || currentUser.id,
        });

        showAlert(`Akun staf baru [${fName}] dengan ID [${sId}] berhasil dibuat.`);
      } else {
        // Mode Update
        const updatePayload: any = {
          fullName: fName,
          name: fName,
          role: sRole,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name || currentUser.id,
        };

        await updateDoc(userRef, updatePayload);
        showAlert(`Data profil staf [${uId}] berhasil diperbarui.`);
      }

      handleCloseStaffModal();
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan data staf.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStaff(u: any) {
    const targetUserId = u.userId || u.id;
    if (String(targetUserId).toLowerCase() === "admin" || String(u.role).toUpperCase().includes("ROOT")) {
      return showAlert("Akun ROOT_ADMIN tidak dapat dihapus demi keamanan sistem!");
    }

    if (!confirm(`Hapus akun staf [${u.fullName || targetUserId}] secara permanen?`)) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, "users", targetUserId));
      showAlert(`Akun staf [${targetUserId}] berhasil dihapus.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menghapus staf.");
    } finally {
      setLoading(false);
    }
  }

  function getNextFamilyCode() {
    let maxNum = 0;
    families.forEach((f) => {
      const code = String(f.familyCode || f.id || "").trim();
      const match = code.match(/FAM-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `FAM-${String(maxNum + 1).padStart(3, "0")}`;
  }

  function handleOpenCreateFamily() {
    const nextCode = getNextFamilyCode();
    setFamilyForm({ familyCode: nextCode, familyName: "" });
    setFamilyModalMode("create");
    setIsFamilyModalOpen(true);
  }

  function handleOpenEditFamily(f: any) {
    setFamilyForm({
      familyCode: f.familyCode || f.id,
      familyName: f.familyName || f.name || "",
    });
    setFamilyModalMode("edit");
    setIsFamilyModalOpen(true);
  }

  async function handleSaveFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!familyForm.familyName.trim()) return showAlert("Nama Family wajib diisi.");

    try {
      setLoading(true);
      const code = familyForm.familyCode;
      const fRef = doc(db, "families", code);

      if (familyModalMode === "create") {
        await setDoc(fRef, {
          familyCode: code,
          familyName: familyForm.familyName.trim(),
          name: familyForm.familyName.trim(),
          createdAt: serverTimestamp(),
          createdBy: currentUser.name || currentUser.id,
        });
        showAlert(`Family baru [${code}] berhasil ditambahkan.`);
      } else {
        await updateDoc(fRef, {
          familyName: familyForm.familyName.trim(),
          name: familyForm.familyName.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name || currentUser.id,
        });
        showAlert(`Family [${code}] berhasil diperbarui.`);
      }
      setIsFamilyModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan Family.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteFamily(f: any) {
    const code = f.familyCode || f.id;
    const isUsed = products.some((p) => p.familyCode === code);
    if (isUsed) {
      return showAlert(`Family [${code}] tidak dapat dihapus karena masih digunakan oleh produk.`);
    }
    if (!confirm(`Hapus Family [${code} -${f.familyName || f.name}]?`)) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, "families", code));
      showAlert(`Family [${code}] berhasil dihapus.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menghapus Family.");
    } finally {
      setLoading(false);
    }
  }

  // --- FUNGSI MIGRASI & PERBAIKAN ID CUSTOMER STRING ACAK KE CUST-xxxx ---
  async function handleMigrateRandomCustomerIds() {
    if (!confirm("Pindai dan ubah seluruh ID string acak customer menjadi format resmi CUST-xxxx secara berurutan?")) return;

    try {
      setLoading(true);
      // Hitung angka tertinggi dari CUST-xxxx yang sudah sah
      let maxNum = 0;
      customers.forEach((c) => {
        const id = String(c.customerId || c.id || "").trim();
        const match = id.match(/CUST-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });

      const randomIdCustomers = customers.filter((c) => {
        const id = String(c.id || "").trim();
        return !id.startsWith("CUST-");
      });

      if (randomIdCustomers.length === 0) {
        return showAlert("Semua customer sudah menggunakan format ID resmi CUST-xxxx. Tidak ada ID string acak yang perlu diperbaiki.");
      }

      let migratedCount = 0;
      for (const oldCust of randomIdCustomers) {
        maxNum += 1;
        const newCustId = `CUST-${String(maxNum).padStart(4, "0")}`;
        const oldDocId = oldCust.id;

        // Tulis ke dokumen dengan ID baru CUST-xxxx
        await setDoc(doc(db, "customers", newCustId), {
          ...oldCust,
          id: newCustId,
          customerId: newCustId,
          migratedFrom: oldDocId,
          updatedAt: serverTimestamp(),
        });

        // Hapus dokumen lama yang ber-ID string acak
        await deleteDoc(doc(db, "customers", oldDocId));
        migratedCount++;
      }

      // Sinkronkan counter
      await setDoc(doc(db, "counters", "customer"), { currentNumber: maxNum, updatedAt: serverTimestamp() }, { merge: true });

      showAlert(`Migrasi berhasil! Sebanyak ${migratedCount} customer ber-ID string acak telah diperbarui ke format CUST-xxxx.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal melakukan migrasi ID Customer.");
    } finally {
      setLoading(false);
    }
  }

  // --- FUNGSI AUDIT SELURUH PRIMARY KEY (ID INTEGRITY) ---
  async function handleRunAuditAllIds() {
    setIsAuditing(true);
    setAuditReport([]);
    try {
      const collectionsToCheck = [
        { name: "products", label: "Master Produk", data: products },
        { name: "customers", label: "Master Customer", data: customers },
        { name: "families", label: "Family Produk", data: families },
        { name: "suppliers", label: "Supplier Rekanan", data: suppliers },
        { name: "users", label: "Akun Pengguna", data: usersList },
        { name: "sales_orders", label: "Sales Order", data: salesOrders },
        { name: "delivery_orders", label: "Delivery Order", data: deliveryOrders },
        { name: "purchase_orders", label: "Purchase Order", data: purchaseOrders },
        { name: "receivings", label: "Penerimaan Barang", data: receivings },
        { name: "stock_opnames", label: "Stock Opname", data: stockOpnames },
        { name: "stock_adjustments", label: "Stock Adjustment", data: stockAdjustments },
      ];

      const reportItems: any[] = [];

      collectionsToCheck.forEach((col) => {
        const idCounts: Record<string, number> = {};
        const duplicates: string[] = [];

        col.data.forEach((item) => {
          const id = String(item.id || item.documentNo || item.sku || item.customerId || "").trim();
          if (id) {
            idCounts[id] = (idCounts[id] || 0) + 1;
            if (idCounts[id] === 2) {
              duplicates.push(id);
            }
          }
        });

        reportItems.push({
          collectionName: col.name,
          collectionLabel: col.label,
          totalRecords: col.data.length,
          duplicateCount: duplicates.length,
          duplicateIds: duplicates,
          status: duplicates.length === 0 ? "VALID" : "DUPLICATE_FOUND",
        });
      });

      setAuditReport(reportItems);
      setIsAuditModalOpen(true);
    } catch (err: any) {
      showAlert(err.message || "Gagal menjalankan audit ID.");
    } finally {
      setIsAuditing(false);
    }
  }

  async function handleDeleteDuplicateRecord(collectionName: string, id: string) {
    if (!confirm(`Hapus salah satu dokumen duplikat [${id}] dari koleksi [${collectionName}]?`)) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, collectionName, id));
      showAlert(`Dokumen duplikat [${id}] berhasil dihapus.`);
      setIsAuditModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menghapus dokumen duplikat.");
    } finally {
      setLoading(false);
    }
  }

    function openWhatsAppChat(phone: string, name: string, type: "CUSTOMER" | "SUPPLIER") {
    const clean = String(phone || "").replace(/[^0-9]/g, "");
    if (!clean) return showAlert("Nomor kontak belum terdaftar atau tidak valid.");
    const formattedPhone = clean.startsWith("0") ? "62" + clean.slice(1) : clean.startsWith("62") ? clean : "62" + clean;
    const text = type === "CUSTOMER"
      ? `Halo Kak ${name}, kami dari Atin's Collection. Ada yang bisa kami bantu terkait pesanan Anda?`
      : `Halo ${name}, kami dari tim gudang Atin's Collection terkait koordinasi pesanan dan pasokan barang.`;
    window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleSaveProduct(savedData: any) {
    try {
      setLoading(true);
      if (isEditingProduct) {
        if (!isRootAdmin) return showAlert("Hanya ROOT_ADMIN yang berwenang mengubah master produk.");
        await updateDoc(doc(db, "products", savedData.sku), {
          itemName: savedData.itemName.trim(),
          supplierId: savedData.supplierId || "",
          supplierName: savedData.supplierName || "",
          purchasingPrice: Number(savedData.purchasingPrice) || 0,
          netPrice: Number(savedData.netPrice) || 0,
          weightInGrams: Number(savedData.weightInGrams) || 0,
          active: Boolean(savedData.active),
          status: savedData.active ? "ACTIVE" : "INACTIVE",
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name || currentUser.id,
        });
        showAlert(`Katalog produk ${savedData.sku} berhasil diperbarui.`);
      } else {
        const famCode = savedData.familyCode || "FAM-001";
        const famNum = parseInt(famCode.replace(/[^0-9]/g, ""), 10) || 1;
        const initStock = Number(savedData.initialStock) || 0;

        await runTransaction(db, async (tx) => {
          const fCountRef = doc(db, "family_counters", famCode);
          const fSnap = await tx.get(fCountRef);
          const curSeq = fSnap.exists() ? (fSnap.data().currentProductNumber || 0) : 0;
          const nextSeq = curSeq + 1;
          const candidateSku = `SKU-${String(famNum).padStart(3, "0")}${String(nextSeq).padStart(3, "0")}`;

          tx.set(fCountRef, { familyCode: famCode, currentProductNumber: nextSeq, updatedAt: serverTimestamp() }, { merge: true });
          tx.set(doc(db, "products", candidateSku), {
            productId: candidateSku,
            sku: candidateSku,
            familyCode: famCode,
            itemName: savedData.itemName.trim(),
            supplierId: savedData.supplierId || "",
            supplierName: savedData.supplierName || "",
            lastReceiving: "-",
            stock: initStock,
            purchasingPrice: Number(savedData.purchasingPrice) || 0,
            netPrice: Number(savedData.netPrice) || 0,
            weightInGrams: Number(savedData.weightInGrams) || 0,
            active: Boolean(savedData.active),
            status: savedData.active ? "ACTIVE" : "INACTIVE",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: currentUser.name || currentUser.id,
          });

          if (initStock > 0) {
            const mvRef = doc(collection(db, "stock_movements"));
            tx.set(mvRef, {
              movementId: mvRef.id,
              date: new Date().toISOString().split("T")[0],
              itemCode: candidateSku,
              itemNameSnapshot: savedData.itemName.trim(),
              type: "ADJUSTMENT",
              referenceId: "INITIAL_STOCK",
              qtyIn: initStock,
              qtyOut: 0,
              previousStock: 0,
              newStock: initStock,
              reason: "Inisialisasi Saldo Awal",
              user: currentUser.name || currentUser.id,
              timestamp: serverTimestamp(),
            });
          }
        });
        showAlert("Produk baru berhasil didaftarkan ke sistem.");
      }
      setIsProductModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan perubahan produk.");
    } finally {
      setLoading(false);
    }
  }

  // Dual-Pathway Loader
  async function loadAllData() {
    setLoading(true);
    try {
      const [
        pSnap, fSnap, cSnap, soSnap, doSnap, poSnap, rcvSnap, sopSnap, adjSnap, mvSnap, setDocSnap, uSnap, suppSnap
      ] = await Promise.all([
        getDocs(query(collection(db, "products"), limit(500))),
        getDocs(query(collection(db, "families"), limit(100))),
        getDocs(query(collection(db, "customers"), limit(300))),
        getDocs(query(collection(db, "sales_orders"), limit(200))),
        getDocs(query(collection(db, "delivery_orders"), limit(200))),
        getDocs(query(collection(db, "purchase_orders"), limit(100))),
        getDocs(query(collection(db, "receivings"), limit(100))),
        getDocs(query(collection(db, "stock_opnames"), limit(100))),
        getDocs(query(collection(db, "stock_adjustments"), limit(100))),
        getDocs(query(collection(db, "stock_movements"), limit(300))),
        getDocs(query(collection(db, "settings"), limit(1))),
        getDocs(query(collection(db, "users"), limit(100))),
        getDocs(query(collection(db, "suppliers"), limit(200))),
      ]);

      setProducts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFamilies(fSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCustomers(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSalesOrders(soSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setDeliveryOrders(doSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPurchaseOrders(poSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setReceivings(rcvSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStockOpnames(sopSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStockAdjustments(adjSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStockMovements(mvSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUsersList(uSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (suppSnap) setSuppliers(suppSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const foundSettings = setDocSnap.docs.find((d) => d.id === "store_info");
      if (foundSettings) {
        const sData = foundSettings.data();
        setStoreSettings((prev: any) => ({ ...prev, ...sData }));
        setSavedSettings(sData);
        if (sData.rajaOngkirApiKey) {
          setInputApiKey(sData.rajaOngkirApiKey);
        }
      }
    } catch {
      try {
        const apiRes = await fetch("/api/portal/data");
        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.success && json.data) {
            const d = json.data;
            setProducts(d.products || []);
            setFamilies(d.families || []);
            setCustomers(d.customers || []);
            setSalesOrders(d.salesOrders || []);
            setDeliveryOrders(d.deliveryOrders || []);
            setPurchaseOrders(d.purchaseOrders || []);
            setReceivings(d.receivings || []);
            setStockOpnames(d.stockOpnames || []);
            setStockAdjustments(d.stockAdjustments || []);
            setStockMovements(d.stockMovements || []);
            setUsersList(d.users || []);
            setSuppliers(d.suppliers || []);
          }
        }
      } catch (fallbackErr) {
        console.error("Gagal sinkronisasi data:", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAllData(); }, []);

  // Filtered Lists
  const displayedSalesOrders = useMemo(() => {
    return salesOrders.filter((so) => {
      const matchesStatus = soStatusFilter === "ALL" || (so.status || "").toUpperCase() === soStatusFilter;
      if (!matchesStatus) return false;
      if (!soSearchQuery.trim()) return true;
      const q = soSearchQuery.toLowerCase();
      const name = String(so.customerName || so.customer?.name || "").toLowerCase();
      const addr = String(so.shippingAddress || so.address || "").toLowerCase();
      const soNo = String(so.soNumber || so.documentNo || so.id || so.soId || "").toLowerCase();
      return name.includes(q) || addr.includes(q) || soNo.includes(q);
    });
  }, [salesOrders, soStatusFilter, soSearchQuery]);

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products;
    const q = productSearchQuery.toLowerCase();
    return products.filter((p) => {
      const sku = String(p.sku || "").toLowerCase();
      const name = String(p.itemName || "").toLowerCase();
      const fam = String(p.familyCode || "").toLowerCase();
      const suppName = String(p.supplierName || "").toLowerCase();
      const suppId = String(p.supplierId || "").toLowerCase();
      return sku.includes(q) || name.includes(q) || fam.includes(q) || suppName.includes(q) || suppId.includes(q);
    });
  }, [products, productSearchQuery]);

  const filteredLedgerProducts = useMemo(() => {
    return products.filter((p) => {
      const q = ledgerSearch.toLowerCase().trim();
      return !q || p.sku.toLowerCase().includes(q) || p.itemName.toLowerCase().includes(q);
    });
  }, [products, ledgerSearch]);

  const selectedProductMovements = useMemo(() => {
    if (!selectedProductLedger) return [];
    return stockMovements.filter((m) => m.itemCode === selectedProductLedger.sku);
  }, [stockMovements, selectedProductLedger]);

  const isBluetoothSettingsChanged = useMemo(() => {
    if (!savedSettings) return true;
    return storeSettings.labelSize !== (savedSettings.labelSize || "58mm");
  }, [storeSettings.labelSize, savedSettings]);

  const isStoreAddressChanged = useMemo(() => {
    if (!savedSettings) return true;
    return (
      storeSettings.storeName !== (savedSettings.storeName || "") ||
      storeSettings.storePhone !== (savedSettings.storePhone || "") ||
      storeSettings.provinceCode !== (savedSettings.provinceCode || "") ||
      storeSettings.regencyCode !== (savedSettings.regencyCode || "") ||
      storeSettings.districtCode !== (savedSettings.districtCode || "") ||
      storeSettings.villageCode !== (savedSettings.villageCode || "") ||
      storeSettings.detailAddress !== (savedSettings.detailAddress || "")
    );
  }, [storeSettings, savedSettings]);

  // Load Geographic Data
  useEffect(() => {
    if ((currentTab === "settings" || isCustomerModalOpen) && provinces.length === 0) {
      setLoadingRegion(true);
      fetch("/api/regions")
        .then((res) => res.json())
        .then((data) => { if (Array.isArray(data)) setProvinces(data); })
        .finally(() => setLoadingRegion(false));
    }
  }, [currentTab, isCustomerModalOpen, provinces.length]);

  async function handleCustProvinceChange(pCode: string) {
    const prov = provinces.find((p) => p.id === pCode);
    setCustomerForm((prev) => ({
      ...prev,
      provinceCode: pCode,
      provinceName: prov?.name || "",
      regencyCode: "",
      regencyName: "",
      districtCode: "",
      districtName: "",
      villageCode: "",
      villageName: "",
    }));
    setCustRegencies([]);
    setCustDistricts([]);
    setCustVillages([]);
    if (!pCode) return;
    setLoadingCustRegion(true);
    try {
      const res = await fetch(`/api/regions?type=regencies&code=${pCode}`);
      const data = await res.json();
      if (Array.isArray(data)) setCustRegencies(data);
    } finally { setLoadingCustRegion(false); }
  }

  async function handleCustRegencyChange(rCode: string) {
    const reg = custRegencies.find((r) => r.id === rCode);
    setCustomerForm((prev) => ({
      ...prev,
      regencyCode: rCode,
      regencyName: reg?.name || "",
      districtCode: "",
      districtName: "",
      villageCode: "",
      villageName: "",
    }));
    setCustDistricts([]);
    setCustVillages([]);
    if (!rCode) return;
    setLoadingCustRegion(true);
    try {
      const res = await fetch(`/api/regions?type=districts&code=${rCode}`);
      const data = await res.json();
      if (Array.isArray(data)) setCustDistricts(data);
    } finally { setLoadingCustRegion(false); }
  }

  async function handleCustDistrictChange(dCode: string) {
    const dist = custDistricts.find((d) => d.id === dCode);
    setCustomerForm((prev) => ({
      ...prev,
      districtCode: dCode,
      districtName: dist?.name || "",
      villageCode: "",
      villageName: "",
    }));
    setCustVillages([]);
    if (!dCode) return;
    setLoadingCustRegion(true);
    try {
      const res = await fetch(`/api/regions?type=villages&code=${dCode}`);
      const data = await res.json();
      if (Array.isArray(data)) setCustVillages(data);
    } finally { setLoadingCustRegion(false); }
  }

  function handleCustVillageChange(vCode: string) {
    const vil = custVillages.find((v) => v.id === vCode);
    setCustomerForm((prev) => ({
      ...prev,
      villageCode: vCode,
      villageName: vil?.name || "",
    }));
  }

  function handleExportAllProducts(format: "pdf" | "excel") {
    const headers = [
      "SKU",
      "Nama Produk",
      "Family",
      "Supplier",
      "HPP (Rp)",
      "Harga Jual (Rp)",
      "Stok Fisik",
      "Berat (gr)",
      "Nilai Saldo Stok (Rp)",
      "Status",
    ];

    const rows = products.map((p) => {
      const stock = Number(p.stock || 0);
      const hpp = Number(p.purchasingPrice || 0);
      const totalNilai = stock * hpp;
      return [
        p.sku,
        p.itemName,
        p.familyCode || "-",
        p.supplierName || "-",
        hpp,
        Number(p.netPrice || 0),
        `${stock} pcs`,
        `${p.weightInGrams || 0} gr`,
        totalNilai,
        p.active !== false ? "AKTIF" : "NONAKTIF",
      ];
    });

    if (format === "pdf") {
      downloadPdf("Katalog Master Produk & Saldo Persediaan", "Katalog_Produk_Lengkap", headers, rows);
    } else {
      downloadExcel("ALL", "Katalog_Produk_Lengkap", headers, rows);
    }
  }

  // Stock Opname Detail / Review
  function handleOpenSopDetail(sop: any) {
    setReviewSopTarget(sop);
    setReviewItemsData(JSON.parse(JSON.stringify(sop.items || [])));
    setIsSopReviewModalOpen(true);
  }

    async function handleCancelSopFromReview() {
    if (!reviewSopTarget) return;
    const reason = prompt("Masukkan alasan pembatalan dokumen Stock Opname:");
    if (!reason || !reason.trim()) {
      return showAlert("Alasan pembatalan wajib diisi!");
    }
    try {
      setLoading(true);
      const targetId = reviewSopTarget.documentNo || reviewSopTarget.sopId || reviewSopTarget.id;
      await updateDoc(doc(db, "stock_opnames", targetId), {
        status: "CANCELLED",
        cancelReason: reason.trim(),
        cancelledAt: serverTimestamp(),
        cancelledBy: currentUser.name || currentUser.id,
      });
      showAlert(`Dokumen SOP [${targetId}] berhasil dibatalkan.`);
      setIsSopReviewModalOpen(false);
      setReviewSopTarget(null);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal membatalkan SOP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteSopReview() {
    if (!reviewSopTarget) return;
    try {
      setLoading(true);
      const targetId = reviewSopTarget.documentNo || reviewSopTarget.sopId || reviewSopTarget.id;
      await updateDoc(doc(db, "stock_opnames", targetId), {
        status: "COMPLETED_REVIEW",
        items: reviewItemsData,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.name || currentUser.id,
      });
      showAlert(`Dokumen SOP [${targetId}] telah selesai direview dan berstatus COMPLETED_REVIEW.`);
      setIsSopReviewModalOpen(false);
      setReviewSopTarget(null);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyelesaikan review SOP.");
    } finally {
      setLoading(false);
    }
  }

  // Stock Opname Posting
  async function handleExecutePostingSop(sop: any) {
    if (!confirm(`Posting stock opname [${sop.documentNo || sop.sopId}]? Saldo fisik produk akan langsung disesuaikan secara permanen.`)) return;

    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];
      const randomSeq = String(Math.floor(100 + Math.random() * 900));
      const postDocId = `POST-${dateStr}-${randomSeq}`;

      await runTransaction(db, async (tx) => {
        const sopTargetId = sop.documentNo || sop.sopId || sop.id;
        const sopRef = doc(db, "stock_opnames", sopTargetId);

        // --- FASE 1: READ SEMUA DOKUMEN TERLEBIH DAHULU ---
        const sopSnap = await tx.get(sopRef);
        if (!sopSnap.exists()) {
          throw new Error("Dokumen Stock Opname tidak ditemukan!");
        }

        const itemsToProcess: Array<{
          pRef: any;
          skuCode: string;
          itemName: string;
          currentStock: number;
          physical: number;
          diff: number;
        }> = [];

        for (const it of sop.items || []) {
          const skuCode = it.skuCode || it.skuId || it.sku;
          const pRef = doc(db, "products", skuCode);
          const pSnap = await tx.get(pRef);

          if (pSnap.exists()) {
            const currentStock = Number(pSnap.data().stock || 0);
            const physical = Number(it.physicalQty ?? currentStock);
            const diff = physical - currentStock;

            itemsToProcess.push({
              pRef,
              skuCode,
              itemName: it.itemName,
              currentStock,
              physical,
              diff,
            });
          }
        }

        // --- FASE 2: WRITE SEMUA DOKUMEN SETELAH SEMUA BACA SELESAI ---
        for (const item of itemsToProcess) {
          tx.update(item.pRef, {
            stock: item.physical,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.name || currentUser.id,
          });

          if (item.diff !== 0) {
            const mvRef = doc(collection(db, "stock_movements"));
            tx.set(mvRef, {
              movementId: mvRef.id,
              date: displayDate,
              itemCode: item.skuCode,
              itemNameSnapshot: item.itemName,
              type: "ADJUSTMENT",
              referenceId: postDocId,
              qtyIn: item.diff > 0 ? item.diff : 0,
              qtyOut: item.diff < 0 ? Math.abs(item.diff) : 0,
              previousStock: item.currentStock,
              newStock: item.physical,
              reason: `Posting Stock Opname (${sopTargetId})`,
              user: currentUser.name || currentUser.id,
              timestamp: serverTimestamp(),
            });
          }
        }

        tx.update(sopRef, {
          status: "POSTED",
          postingId: postDocId,
          postedAt: serverTimestamp(),
          postedBy: currentUser.name || currentUser.id,
        });
      });

      showAlert(`Stock Opname berhasil diposting dengan nomor dokumen [${postDocId}]. Saldo fisik produk telah disesuaikan.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal memposting Stock Opname.");
    } finally {
      setLoading(false);
    }
  }

  // SO Status & Handlers
  async function executeMarkProcessing(so: any) {
    try {
      setLoading(true);
      await updateDoc(doc(db, "sales_orders", so.soId || so.id), {
        status: "PROCESSING",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name || currentUser.id,
      });
      setIsSoDetailModalOpen(false);
      showAlert(`Status SO [${so.soId}] diubah ke PROCESSING.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal mengubah status SO.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkReadyToDeliver(so: any) {
    try {
      setLoading(true);
      await updateDoc(doc(db, "sales_orders", so.soId || so.id), {
        status: "READY TO DELIVER",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name || currentUser.id,
      });
      setIsSoDetailModalOpen(false);
      showAlert(`SO [${so.soId}] berstatus READY TO DELIVER. Siap diterbitkan DO.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal mengubah status SO.");
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessDO(so: any) {
    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];

      const counterRef = doc(db, "counters", "delivery_order");
      const soRef = doc(db, "sales_orders", so.soId || so.id);

      const doId = await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(counterRef);
        const curr = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
        const next = curr + 1;
        const generatedDoId = `DO-${dateStr}-${String(next).padStart(5, "0")}`;

        for (const it of so.items || []) {
          const pRef = doc(db, "products", it.sku);
          const pSnap = await tx.get(pRef);
          if (!pSnap.exists()) throw new Error(`Produk ${it.sku} tidak ditemukan!`);
          const liveStock = pSnap.data().stock || 0;
          if (liveStock < (it.qty || it.quantity || 1)) {
            throw new Error(`Stok produk ${it.itemName} (${it.sku}) tidak cukup! Sisa: ${liveStock}`);
          }
        }

        tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() });
        for (const it of so.items || []) {
          const pRef = doc(db, "products", it.sku);
          const pSnap = await tx.get(pRef);
          const oldStock = pSnap.data()?.stock || 0;
          const dedQty = Number(it.qty || it.quantity || 1);
          const newStock = oldStock - dedQty;

          tx.update(pRef, { stock: newStock, updatedAt: serverTimestamp(), updatedBy: currentUser.name || currentUser.id });

          const mvRef = doc(collection(db, "stock_movements"));
          tx.set(mvRef, {
            movementId: mvRef.id,
            date: displayDate,
            itemCode: it.sku,
            itemNameSnapshot: it.itemName,
            type: "DELIVERY",
            referenceId: generatedDoId,
            qtyIn: 0,
            qtyOut: dedQty,
            previousStock: oldStock,
            newStock: newStock,
            reason: `Pengiriman DO ${generatedDoId} (SO: ${so.soId})`,
            user: currentUser.name || currentUser.id,
            timestamp: serverTimestamp(),
          });
        }

        tx.update(soRef, { status: "DELIVERY ORDER", updatedAt: serverTimestamp(), updatedBy: currentUser.name || currentUser.id });

        tx.set(doc(db, "delivery_orders", generatedDoId), {
          doId: generatedDoId,
          soId: so.soId || so.id,
          date: displayDate,
          expedition: so.expedition || so.shippingServiceName || "-",
          senderName: storeSettings.storeName,
          senderPhone: storeSettings.storePhone,
          senderAddress: storeSettings.storeAddress,
          recipientName: so.customerName || "-",
          recipientPhone: so.phone || "-",
          recipientAddress: so.address || "-",
          totalItems: (so.items || []).length,
          totalPcs: (so.items || []).reduce((acc: number, it: any) => acc + (Number(it.qty || it.quantity) || 1), 0),
          totalWeightInGrams: so.totalWeightInGrams || 0,
          shippingCost: so.shippingCost || 0,
          shippingCourier: so.shippingCourier || "",
          shippingServiceName: so.shippingServiceName || "",
          items: so.items || [],
          isStockDeducted: true,
          createdBy: currentUser.name || currentUser.id,
          createdAt: serverTimestamp(),
          status: "DELIVERED",
        });
        return generatedDoId;
      });

      setIsSoDetailModalOpen(false);
      showAlert(`Delivery Order [${doId}] berhasil diterbitkan dan stok fisik terpotong.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal memproses Delivery Order.");
    } finally {
      setLoading(false);
    }
  }

  async function executeCancelSo() {
    if (!soCancelTarget) return;
    if (!soCancelReason.trim()) return showAlert("Alasan pembatalan SO wajib diisi.");
    try {
      setLoading(true);
      const targetId = soCancelTarget.soId || soCancelTarget.id;
      await updateDoc(doc(db, "sales_orders", targetId), {
        status: "CANCELLED",
        cancelReason: soCancelReason.trim(),
        cancelledAt: serverTimestamp(),
        cancelledBy: currentUser.name || currentUser.id,
        updatedAt: serverTimestamp(),
      });
      setIsSoCancelConfirmOpen(false);
      setIsSoDetailModalOpen(false);
      setSoCancelTarget(null);
      setSoCancelReason("");
      showAlert(`Sales Order [${targetId}] berhasil dibatalkan.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal membatalkan Sales Order.");
    } finally {
      setLoading(false);
    }
  }

  // Receiving Process Trigger
  function handleOpenReceivingModal(po: any) {
    setSelectedPoForReceiving(po);
    const initialInputs: Record<string, number> = {};
    (po.items || []).forEach((it: any) => {
      initialInputs[it.sku] = Number(it.qty) || 0;
    });
    setReceivingInputs(initialInputs);
    setIsSelectPoForReceivingOpen(false);
    setIsReceivingModalOpen(true);
  }

  async function handleExecuteReceiving() {
    if (!selectedPoForReceiving) return;

    for (const it of selectedPoForReceiving.items || []) {
      const incoming = Number(receivingInputs[it.sku] ?? 0);
      const maxQty = Number(it.qty) || 0;
      if (incoming > maxQty) {
        return showAlert(`Barang [${it.itemName}] melebihi kuantitas pesanan PO (Maksimal: ${maxQty} pcs, Diinput: ${incoming} pcs). Input ditolak.`);
      }
    }

    if (!confirm(`Konfirmasi penerimaan barang untuk PO [${selectedPoForReceiving.poId || selectedPoForReceiving.documentNo}]?`)) return;

    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];
      const rcvId = `RCV-${dateStr}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const poTargetId = selectedPoForReceiving.poId || selectedPoForReceiving.documentNo || selectedPoForReceiving.id;

      await runTransaction(db, async (tx) => {
        const poRef = doc(db, "purchase_orders", poTargetId);

        // --- FASE 1: READ SEMUA DOKUMEN DAHULU ---
        const poSnap = await tx.get(poRef);
        if (!poSnap.exists()) {
          throw new Error("Dokumen Purchase Order tidak ditemukan!");
        }

        const itemsToUpdate: Array<{
          pRef: any;
          sku: string;
          itemName: string;
          qtyRcv: number;
          curStock: number;
          newStock: number;
        }> = [];

        for (const it of selectedPoForReceiving.items || []) {
          const qtyRcv = Number(receivingInputs[it.sku] ?? 0);
          if (qtyRcv > 0) {
            const pRef = doc(db, "products", it.sku);
            const pSnap = await tx.get(pRef);
            if (pSnap.exists()) {
              const curStock = Number(pSnap.data().stock || 0);
              const newStock = curStock + qtyRcv;
              itemsToUpdate.push({
                pRef,
                sku: it.sku,
                itemName: it.itemName,
                qtyRcv,
                curStock,
                newStock,
              });
            }
          }
        }

        // --- FASE 2: WRITE SEMUA DOKUMEN SETELAH READ SELESAI ---
        for (const item of itemsToUpdate) {
          tx.update(item.pRef, {
            stock: item.newStock,
            lastReceiving: displayDate,
            updatedAt: serverTimestamp(),
          });

          const mvRef = doc(collection(db, "stock_movements"));
          tx.set(mvRef, {
            movementId: mvRef.id,
            date: displayDate,
            itemCode: item.sku,
            itemNameSnapshot: item.itemName,
            type: "RECEIVING",
            referenceId: rcvId,
            qtyIn: item.qtyRcv,
            qtyOut: 0,
            previousStock: item.curStock,
            newStock: item.newStock,
            reason: `Penerimaan Barang PO ${selectedPoForReceiving.poId || selectedPoForReceiving.documentNo}`,
            user: currentUser.name || currentUser.id,
            timestamp: serverTimestamp(),
          });
        }

        tx.update(poRef, {
          status: "COMPLETED",
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name || currentUser.id,
        });

        tx.set(doc(db, "receivings", rcvId), {
          receivingId: rcvId,
          documentNo: rcvId,
          poId: selectedPoForReceiving.poId || selectedPoForReceiving.documentNo,
          supplier: selectedPoForReceiving.supplier,
          date: displayDate,
          items: (selectedPoForReceiving.items || []).map((it: any) => ({
            sku: it.sku,
            itemName: it.itemName,
            qtyReceived: Number(receivingInputs[it.sku] ?? 0),
          })),
          createdBy: currentUser.name || currentUser.id,
          createdAt: serverTimestamp(),
        });
      });

      showAlert(`Proses penerimaan barang berhasil disimpan dengan Dokumen [${rcvId}].`);
      setIsReceivingModalOpen(false);
      setSelectedPoForReceiving(null);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal memproses receiving.");
    } finally {
      setLoading(false);
    }
  }

  // Sales by Item by Day
  const salesByItemByDayData = useMemo(() => {
    const rows: any[] = [];
    deliveryOrders.forEach((d) => {
      (d.items || []).forEach((it: any) => {
        const qty = Number(it.qty || it.quantity || 1);
        const price = Number(it.price || it.netPrice || 0);
        const subtotal = Number(it.subtotal || qty * price);
        rows.push({
          date: d.date,
          doId: d.doId,
          soId: d.soId,
          recipient: d.recipientName,
          sku: it.sku,
          itemName: it.itemName,
          qty,
          price,
          subtotal,
        });
      });
    });
    return rows;
  }, [deliveryOrders]);

  // Sales Summary by Day
  const salesSummaryByDayData = useMemo(() => {
    const summaryMap: Record<string, { date: string; sku: string; itemName: string; totalQty: number; totalNominal: number }> = {};

    deliveryOrders.forEach((d) => {
      (d.items || []).forEach((it: any) => {
        const qty = Number(it.qty || it.quantity || 1);
        const price = Number(it.price || it.netPrice || 0);
        const subtotal = Number(it.subtotal || qty * price);
        const key = `${d.date}_${it.sku}`;

        if (!summaryMap[key]) {
          summaryMap[key] = {
            date: d.date,
            sku: it.sku,
            itemName: it.itemName,
            totalQty: 0,
            totalNominal: 0,
          };
        }
        summaryMap[key].totalQty += qty;
        summaryMap[key].totalNominal += subtotal;
      });
    });

    return Object.values(summaryMap);
  }, [deliveryOrders]);

  // Customer Management
  async function handleOpenCustomerModal(mode: "create" | "edit", cust?: any) {
    setCustomerModalMode(mode);
    setCustRegencies([]);
    setCustDistricts([]);
    setCustVillages([]);

    if (mode === "create") {
      setCustomerForm({
        customerId: "",
        customerName: "",
        phone: "",
        email: "",
        provinceCode: "",
        provinceName: "",
        regencyCode: "",
        regencyName: "",
        districtCode: "",
        districtName: "",
        villageCode: "",
        villageName: "",
        detailAddress: "",
        postalCode: "",
      });
    } else if (cust) {
      setCustomerForm({
        customerId: cust.id || cust.customerId || "",
        customerName: cust.customerName || "",
        phone: cust.phone || "",
        email: cust.email || "",
        provinceCode: cust.provinceCode || "",
        provinceName: cust.provinceName || "",
        regencyCode: cust.regencyCode || "",
        regencyName: cust.regencyName || "",
        districtCode: cust.districtCode || "",
        districtName: cust.districtName || "",
        villageCode: cust.villageCode || "",
        villageName: cust.villageName || "",
        detailAddress: cust.detailAddress || cust.address || "",
        postalCode: cust.postalCode || "",
      });

      if (cust.provinceCode) {
        fetch(`/api/regions?type=regencies&code=${cust.provinceCode}`)
          .then((r) => r.json())
          .then((d) => { if (Array.isArray(d)) setCustRegencies(d); });
      }
      if (cust.regencyCode) {
        fetch(`/api/regions?type=districts&code=${cust.regencyCode}`)
          .then((r) => r.json())
          .then((d) => { if (Array.isArray(d)) setCustDistricts(d); });
      }
      if (cust.districtCode) {
        fetch(`/api/regions?type=villages&code=${cust.districtCode}`)
          .then((r) => r.json())
          .then((d) => { if (Array.isArray(d)) setCustVillages(d); });
      }
    }
    setIsCustomerModalOpen(true);
  }

  async function handleSaveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.customerName.trim()) return showAlert("Nama Customer wajib diisi.");
    if (!customerForm.provinceName || !customerForm.regencyName || !customerForm.districtName || !customerForm.villageName) {
      return showAlert("Pilih wilayah secara lengkap (Provinsi hingga Desa/Kelurahan).");
    }

    const fullFormattedAddress = `${customerForm.detailAddress ? customerForm.detailAddress.trim() + ", " : ""}Desa/Kel. ${customerForm.villageName}, Kec. ${customerForm.districtName}, ${customerForm.regencyName}, ${customerForm.provinceName}${customerForm.postalCode ? " " + customerForm.postalCode : ""}`;

    try {
      setLoading(true);
      if (customerModalMode === "create") {
        // Hitung auto-increment berdasarkan nomor tertinggi CUST-xxxx yang sudah ada
        let highestNum = 0;
        customers.forEach((c) => {
          const cid = String(c.customerId || c.id || "").trim();
          const match = cid.match(/CUST-(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > highestNum) highestNum = num;
          }
        });

        const counterRef = doc(db, "counters", "customer");
        const nextCustId = await runTransaction(db, async (tx) => {
          const cSnap = await tx.get(counterRef);
          const currFromCounter = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
          const next = Math.max(highestNum, currFromCounter) + 1;
          const genId = `CUST-${String(next).padStart(4, "0")}`;
          tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() }, { merge: true });
          tx.set(doc(db, "customers", genId), {
            customerId: genId,
            customerName: customerForm.customerName.trim(),
            phone: customerForm.phone.trim(),
            email: customerForm.email.trim(),
            provinceCode: customerForm.provinceCode,
            provinceName: customerForm.provinceName,
            regencyCode: customerForm.regencyCode,
            regencyName: customerForm.regencyName,
            districtCode: customerForm.districtCode,
            districtName: customerForm.districtName,
            villageCode: customerForm.villageCode,
            villageName: customerForm.villageName,
            detailAddress: customerForm.detailAddress.trim(),
            postalCode: customerForm.postalCode.trim(),
            address: fullFormattedAddress,
            displayAddress: fullFormattedAddress,
            createdAt: serverTimestamp(),
            createdBy: currentUser.name || currentUser.id,
          });
          return genId;
        });
        showAlert(`Customer [${nextCustId}] berhasil didaftarkan.`);
      } else {
        await updateDoc(doc(db, "customers", customerForm.customerId), {
          customerName: customerForm.customerName.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          provinceCode: customerForm.provinceCode,
          provinceName: customerForm.provinceName,
          regencyCode: customerForm.regencyCode,
          regencyName: customerForm.regencyName,
          districtCode: customerForm.districtCode,
          districtName: customerForm.districtName,
          villageCode: customerForm.villageCode,
          villageName: customerForm.villageName,
          detailAddress: customerForm.detailAddress.trim(),
          postalCode: customerForm.postalCode.trim(),
          address: fullFormattedAddress,
          displayAddress: fullFormattedAddress,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name || currentUser.id,
        });
        showAlert(`Data customer [${customerForm.customerId}] berhasil diperbarui.`);
      }
      setIsCustomerModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan data customer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#FDF9FA] font-sans text-slate-800">
      {/* Session Timeout Dialog */}
      {isSessionTimeoutOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-70">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl border border-slate-200 text-center">
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">Sesi Berakhir</h3>
            <p className="text-xs text-slate-600 mb-5">Waktu sesi operasional telah habis demi keamanan data.</p>
            <button
              type="button"
              onClick={handleSessionTimeoutLogout}
              className="w-full py-2 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg"
            >
              Keluar ke Login
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Tutup navigasi"
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-[#4A1528] bg-[#3B1220] text-rose-100 shadow-xl transition-transform duration-200 md:relative md:inset-auto md:z-auto md:translate-x-0 md:shrink-0 ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="p-5 border-b border-[#4A1528]">
          <h1 className="text-sm font-bold text-white tracking-wide">Atin&apos;s Collection</h1>
          <p className="text-[11px] text-rose-300/80 mt-0.5">Warehouse Management System</p>
          <div className="mt-3.5 px-3 py-2 bg-[#4A1528] rounded-lg text-xs flex justify-between items-center text-rose-200">
            <span className="truncate pr-2">
              Login: <b className="text-white">{currentUser.name || currentUser.id || "Administrator"}</b>
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
              isRootAdmin 
                ? "bg-amber-600 text-white" 
                : currentUser.role === "ADMIN_GUDANG" 
                ? "bg-purple-600 text-white" 
                : "bg-slate-600 text-white"
            }`}>
              {isRootAdmin ? "ROOT_ADMIN" : (currentUser.role || "STAFF_GUDANG")}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "sales", label: "Sales & Delivery Order" },
            { key: "inventory", label: "Katalog Persediaan" },
            { key: "purchase", label: "Purchase & Receiving" },
            { key: "reports", label: "Pusat Laporan Historis" },
            { key: "settings", label: "Konfigurasi Sistem" },
            ...(isRootAdmin ? [{ key: "human", label: "Manajemen Staf & Relasi" }] : []),
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setCurrentTab(item.key as MainTab);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                currentTab === item.key ? "bg-[#9F1239] text-white shadow-xs" : "text-rose-200 hover:bg-[#4A1528]"
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#4A1528]">
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="w-full py-2 bg-[#881337] hover:bg-[#70102E] text-white text-xs font-semibold rounded-lg transition"
          >
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* WORKSPACE CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5 shadow-xs">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 md:hidden"
          >
            Menu
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {currentTab === "dashboard" && "Dashboard Operasional Gudang"}
              {currentTab === "sales" && "Manajemen Sales Order & Delivery Order"}
              {currentTab === "inventory" && "Katalog Persediaan & Stock Opname"}
              {currentTab === "purchase" && "Purchasing & Penerimaan Barang"}
              {currentTab === "reports" && "Pusat Laporan Historis & Penjualan"}
              {currentTab === "settings" && "Konfigurasi Perangkat & Toko"}
              {currentTab === "human" && "Manajemen Staf, Vendor & Pelanggan"}
            </h2>
            <p className="text-[11px] text-slate-500">Database Firestore Realtime</p>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              onNavigateToDocument={(type) => {
                if (type === "SO" || type === "DO") setCurrentTab("sales");
                else if (type === "PO" || type === "RECEIVING") setCurrentTab("purchase");
                else if (type === "SOP" || type === "ADJ") setCurrentTab("inventory");
              }}
              showAlert={showAlert}
            />
            <button
              type="button"
              onClick={loadAllData}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium border border-slate-200 transition"
            >
              Sinkron Data
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-auto p-5">
          {/* TAB 1: DASHBOARD */}
          {currentTab === "dashboard" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">Total Master SKU</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{products.length} SKU</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">Total Saldo Fisik</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {products.reduce((acc, p) => acc + Number(p.stock || 0), 0)} pcs
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">SO Status Processing</div>
                <div className="text-2xl font-bold text-purple-700 mt-1">
                  {salesOrders.filter((s) => s.status === "PROCESSING").length} Dokumen
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">SO Ready to Deliver</div>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {salesOrders.filter((s) => s.status === "READY TO DELIVER").length} Dokumen
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SALES & DO */}
          {currentTab === "sales" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSalesSubTab("so")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      salesSubTab === "so" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    Sales Order ({salesOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesSubTab("do")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      salesSubTab === "do" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    Delivery Order ({deliveryOrders.length})
                  </button>
                </div>

                {salesSubTab === "so" && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">Filter Status:</span>
                    <select
                      value={soStatusFilter}
                      onChange={(e) => setSoStatusFilter(e.target.value)}
                      className="p-1.5 border border-slate-200 rounded-lg bg-white font-medium text-slate-800 outline-none"
                    >
                      <option value="ALL">Semua Status ({salesOrders.length})</option>
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="READY TO DELIVER">READY TO DELIVER</option>
                      <option value="DELIVERY ORDER">DELIVERY ORDER</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                )}
              </div>

              {/* LIST SO */}
              {salesSubTab === "so" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <span className="text-xs font-bold text-slate-800">
                      Menampilkan {displayedSalesOrders.length} Sales Order
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Cari SO..."
                        value={soSearchQuery}
                        onChange={(e) => setSoSearchQuery(e.target.value)}
                        className="p-1.5 px-3 border border-slate-200 rounded-lg text-xs outline-none w-full sm:w-64 bg-slate-50 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSoId(null);
                          setSoModalInitCustomer(null);
                          setSoModalInitItems([]);
                          setSoModalInitRates([]);
                          setSoModalInitCost(0);
                          setSoModalInitCourier("KURIR_TOKO");
                          setSoModalInitService("Kurir Toko (Tarif Manual)");
                          setIsSoModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs whitespace-nowrap transition"
                      >
                        + Buat Sales Order Baru
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">No SO</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Pelanggan</th>
                          <th className="p-2.5">Total Qty</th>
                          <th className="p-2.5">Ekspedisi &amp; Ongkir</th>
                          <th className="p-2.5">Total Bayar</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-center">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedSalesOrders.map((so) => (
                          <tr key={so.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-mono font-bold text-slate-900">{so.soId}</td>
                            <td className="p-2.5">{so.date}</td>
                            <td className="p-2.5">
                              <div className="font-semibold text-slate-900">{so.customerName}</div>
                              <div className="text-[10px] text-slate-500">{so.phone}</div>
                            </td>
                            <td className="p-2.5">
                              {(so.items || []).reduce((acc: number, it: any) => acc + (Number(it.qty || it.quantity) || 0), 0)} pcs
                            </td>
                            <td className="p-2.5">
                              <div>{so.shippingServiceName || so.expedition || "-"}</div>
                              <div className="text-[10px] text-slate-500">{formatRupiah(Number(so.shippingCost || 0))}</div>
                            </td>
                            <td className="p-2.5 font-bold text-emerald-700">{formatRupiah(Number(so.total || 0))}</td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                so.status === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                                so.status === "PROCESSING" ? "bg-purple-100 text-purple-800" :
                                so.status === "READY TO DELIVER" ? "bg-amber-100 text-amber-800" :
                                so.status === "DELIVERY ORDER" ? "bg-emerald-100 text-emerald-800" :
                                "bg-rose-100 text-rose-800"
                              }`}>
                                {so.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSoDetail(so);
                                  setIsSoDetailModalOpen(true);
                                }}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded text-xs font-semibold"
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* LIST DO */}
              {salesSubTab === "do" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase">Daftar Delivery Order</span>
                    <span className="text-xs text-slate-500">Total: <b>{deliveryOrders.length}</b> DO</span>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">No DO</th>
                          <th className="p-2.5">Ref SO</th>
                          <th className="p-2.5">Penerima</th>
                          <th className="p-2.5">Ekspedisi</th>
                          <th className="p-2.5">Total Pcs</th>
                          <th className="p-2.5">Total Nilai Penjualan (Rp)</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveryOrders.map((d) => {
                          const totalNilaiDo = (d.items || []).reduce((acc: number, it: any) => acc + (Number(it.subtotal) || (Number(it.qty || 1) * Number(it.price || 0))), 0);
                          return (
                            <tr key={d.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-mono font-bold text-slate-900">{d.doId}</td>
                              <td className="p-2.5 font-mono">{d.soId}</td>
                              <td className="p-2.5">{d.recipientName}</td>
                              <td className="p-2.5">{d.expedition}</td>
                              <td className="p-2.5 font-bold">{d.totalPcs} pcs</td>
                              <td className="p-2.5 font-bold text-emerald-700">{formatRupiah(totalNilaiDo)}</td>
                              <td className="p-2.5">{d.date}</td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {d.status || "DELIVERED"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {currentTab === "inventory" && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-200 pb-2">
                {[
                  { key: "products", label: `Produk & Stok (${products.length})` },
                  { key: "card", label: "Kartu Mutasi" },
                  { key: "adjustment", label: `Stock Adjustment (${stockAdjustments.length})` },
                  { key: "opname", label: "Stock Opname (Counting)" },
                  { key: "opname_posting", label: "Stock Opname Posting" },
                  { key: "movement", label: `Histori Mutasi (${stockMovements.length})` },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setInvSubTab(st.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      invSubTab === st.key ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* 3.1 PRODUK & STOK */}
              {invSubTab === "products" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Master Data Produk &amp; Persediaan</span>
                      <p className="text-[11px] text-slate-500">Saldo persediaan fisik terkini di gudang</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleExportAllProducts("pdf")}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                      >
                        Ekspor PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportAllProducts("excel")}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                      >
                        Ekspor Excel
                      </button>
                      <input
                        type="text"
                        placeholder="Cari SKU / Nama / Supplier..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="p-1.5 px-3 border border-slate-200 rounded-lg text-xs outline-none w-full sm:w-56 bg-slate-50 focus:bg-white"
                      />
                      {isRootAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingProduct(false);
                            setProductFormData({
                              sku: "",
                              itemName: "",
                              familyCode: families[0]?.familyCode || "",
                              weightInGrams: 0,
                              active: true,
                              purchasingPrice: 0,
                              netPrice: 0,
                              initialStock: 0,
                              supplierId: "",
                              supplierName: "",
                            });
                            setIsProductModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs whitespace-nowrap"
                        >
                          + Tambah Produk Baru
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Nama Produk</th>
                          <th className="p-2.5">Stok Fisik</th>
                          {isRootAdmin && <th className="p-2.5">HPP (Beli)</th>}
                          <th className="p-2.5">Harga Jual</th>
                          <th className="p-2.5">Total Saldo Nilai Stok (Rp)</th>
                          <th className="p-2.5">Supplier Rekanan</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((p) => {
                          const stock = Number(p.stock || 0);
                          const hpp = Number(p.purchasingPrice || 0);
                          const totalNilaiStok = stock * hpp;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-mono font-bold text-slate-900">{p.sku}</td>
                              <td className="p-2.5 font-semibold text-slate-900">{p.itemName}</td>
                              <td className="p-2.5 font-bold text-emerald-700">{stock} pcs</td>
                              {isRootAdmin && <td className="p-2.5">{formatRupiah(hpp)}</td>}
                              <td className="p-2.5 font-bold">{formatRupiah(Number(p.netPrice || 0))}</td>
                              <td className="p-2.5 font-bold text-emerald-800">{formatRupiah(totalNilaiStok)}</td>
                              <td className="p-2.5 font-medium">{p.supplierName || "-"}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                  {p.active ? "Aktif" : "Nonaktif"}
                                </span>
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingProduct(true);
                                    setProductFormData({
                                      sku: p.sku,
                                      itemName: p.itemName,
                                      familyCode: p.familyCode || "",
                                      weightInGrams: p.weightInGrams || 0,
                                      active: p.active !== false,
                                      purchasingPrice: p.purchasingPrice || 0,
                                      netPrice: p.netPrice || 0,
                                      initialStock: p.stock || 0,
                                      supplierId: p.supplierId || "",
                                      supplierName: p.supplierName || "",
                                    });
                                    setIsProductModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded text-[11px] font-semibold"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3.2 KARTU MUTASI */}
              {invSubTab === "card" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs font-bold text-slate-900">Buku Besar Kartu Mutasi Produk</span>
                    <input
                      type="text"
                      placeholder="Cari SKU / Nama Barang..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="w-64 px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none bg-white"
                    />
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">SKU</th>
                        <th className="p-2.5">Nama Produk</th>
                        <th className="p-2.5">Saldo Stok Fisik</th>
                        <th className="p-2.5 text-right">Kartu Mutasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLedgerProducts.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{p.sku}</td>
                          <td className="p-2.5 font-medium">{p.itemName}</td>
                          <td className="p-2.5 font-bold text-emerald-700">{p.stock || 0} pcs</td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedProductLedger(p)}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded text-[11px] font-semibold"
                            >
                              Lihat Mutasi
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3.3 STOCK ADJUSTMENT */}
              {invSubTab === "adjustment" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Penyesuaian Stok (Stock Adjustment)</span>
                      <p className="text-[11px] text-slate-500">Koreksi saldo fisik secara atomik</p>
                    </div>
                    {!isStaff && (
                      <button
                        type="button"
                        onClick={() => setIsAdjModalOpen(true)}
                        className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        + Buat Penyesuaian Stok
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">No Dokumen</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Nama Produk</th>
                          <th className="p-2.5">Tipe</th>
                          <th className="p-2.5">Qty</th>
                          <th className="p-2.5">Stok Sebelum</th>
                          <th className="p-2.5">Stok Baru</th>
                          <th className="p-2.5">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockAdjustments.map((adj) => (
                          <tr key={adj.id}>
                            <td className="p-2.5 font-mono font-bold text-slate-900">{adj.documentNo || adj.adjustmentId}</td>
                            <td className="p-2.5">{adj.date}</td>
                            <td className="p-2.5 font-mono font-bold">{adj.sku}</td>
                            <td className="p-2.5 font-medium">{adj.itemName}</td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${adj.adjustmentType === "INCREASE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                {adj.adjustmentType}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold">{adj.adjustmentType === "INCREASE" ? `+${adj.adjustmentQty}` : `-${adj.adjustmentQty}`}</td>
                            <td className="p-2.5 text-slate-500">{adj.currentStock ?? "-"}</td>
                            <td className="p-2.5 font-bold text-slate-900">{adj.newStock ?? "-"}</td>
                            <td className="p-2.5 max-w-xs truncate">{adj.reason || "-"}</td>
                          </tr>
                        ))}
                        {stockAdjustments.length === 0 && (
                          <tr><td colSpan={9} className="p-4 text-center text-slate-400">Belum ada data penyesuaian stok.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3.4 STOCK OPNAME COUNTING */}
              {invSubTab === "opname" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Dokumen Stock Opname</span>
                      <p className="text-[11px] text-slate-500">Penghitungan fisik dari aplikasi dan tahap review penyesuaian</p>
                    </div>
                    {!isStaff && isRootAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsInitSopModalOpen(true)}
                        className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        + Inisialisasi SOP Baru
                      </button>
                    )}
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">No Dokumen</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Total SKU</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockOpnames.map((sop) => (
                        <tr key={sop.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{sop.documentNo || sop.sopId}</td>
                          <td className="p-2.5">{sop.opnameDate}</td>
                          <td className="p-2.5 font-bold">{sop.totalSku} SKU</td>
                          <td className="p-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              sop.status === "COMPLETED_REVIEW" ? "bg-blue-100 text-blue-800" :
                              sop.status === "POSTED" ? "bg-emerald-100 text-emerald-800" :
                              sop.status === "COUNTING_COMPLETED" ? "bg-purple-100 text-purple-800" :
                              "bg-amber-100 text-amber-800"
                            }`}>
                              {sop.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenSopDetail(sop)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded text-[11px] font-semibold"
                            >
                              Detail / Review
                            </button>
                          </td>
                        </tr>
                      ))}
                      {stockOpnames.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400">Belum ada dokumen Stock Opname.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3.5 STOCK OPNAME POSTING */}
              {invSubTab === "opname_posting" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Stock Opname Posting</span>
                      <p className="text-[11px] text-slate-500">Posting dokumen SOP berstatus COMPLETED_REVIEW ke saldo persediaan fisik</p>
                    </div>
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">No Dokumen SOP</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Total SKU</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Kode Posting</th>
                        <th className="p-2.5 text-right">Tindakan Posting</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockOpnames.filter((s) => s.status === "COMPLETED_REVIEW" || s.status === "POSTED").map((sop) => (
                        <tr key={sop.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{sop.documentNo || sop.sopId}</td>
                          <td className="p-2.5">{sop.opnameDate}</td>
                          <td className="p-2.5 font-bold">{sop.totalSku} SKU</td>
                          <td className="p-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${sop.status === "POSTED" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                              {sop.status}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-700 font-semibold">{sop.postingId || "-"}</td>
                          <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                            {sop.status === "COMPLETED_REVIEW" && isRootAdmin && (
                              <button
                                type="button"
                                onClick={() => handleExecutePostingSop(sop)}
                                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-semibold"
                              >
                                Posting SOP
                              </button>
                            )}
                            {sop.status === "POSTED" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (sop.items || []).map((it: any) => [
                                      it.skuCode || it.skuId || it.sku,
                                      it.itemName,
                                      it.systemQtySnapshot ?? 0,
                                      it.physicalQty ?? "-",
                                      Number(it.physicalQty || 0) - Number(it.systemQtySnapshot || 0),
                                    ]);
                                    downloadPdf(`Posting Stock Opname (${sop.postingId || sop.documentNo})`, `POST_SOP_${sop.postingId || sop.documentNo}`, ["SKU", "Nama Produk", "Qty Sistem", "Qty Fisik", "Selisih"], rows);
                                  }}
                                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[11px] font-semibold"
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (sop.items || []).map((it: any) => [
                                      sop.postingId,
                                      sop.documentNo || sop.sopId,
                                      sop.opnameDate,
                                      it.skuCode || it.skuId || it.sku,
                                      it.itemName,
                                      it.systemQtySnapshot ?? 0,
                                      it.physicalQty ?? "-",
                                      Number(it.physicalQty || 0) - Number(it.systemQtySnapshot || 0),
                                    ]);
                                    downloadExcel(sop.postingId || "POST", "Posting_SOP", ["Kode Posting", "Ref SOP", "Tanggal", "SKU", "Nama Produk", "Qty Sistem", "Qty Fisik", "Selisih"], rows);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-semibold"
                                >
                                  Excel
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3.6 HISTORI MUTASI */}
              {invSubTab === "movement" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 uppercase">Histori Mutasi Stok Barang</span>
                    <span className="text-xs text-slate-500">Total: <b>{stockMovements.length}</b> Log</span>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Nama Barang</th>
                          <th className="p-2.5">Tipe</th>
                          <th className="p-2.5">Masuk</th>
                          <th className="p-2.5">Keluar</th>
                          <th className="p-2.5">Saldo Akhir</th>
                          <th className="p-2.5">Referensi</th>
                          <th className="p-2.5">Petugas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockMovements.map((m, idx) => (
                          <tr key={m.id || idx}>
                            <td className="p-2.5">{m.date}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-900">{m.itemCode}</td>
                            <td className="p-2.5">{m.itemNameSnapshot}</td>
                            <td className="p-2.5 font-bold">{m.type}</td>
                            <td className="p-2.5 text-emerald-700 font-bold">{m.qtyIn > 0 ? `+${m.qtyIn}` : "-"}</td>
                            <td className="p-2.5 text-rose-700 font-bold">{m.qtyOut > 0 ? `-${m.qtyOut}` : "-"}</td>
                            <td className="p-2.5 font-bold">{m.newStock}</td>
                            <td className="p-2.5 text-[11px] text-slate-600">{m.referenceId}</td>
                            <td className="p-2.5">{m.user}</td>
                          </tr>
                        ))}
                        {stockMovements.length === 0 && (
                          <tr><td colSpan={9} className="p-4 text-center text-slate-400">Belum ada histori mutasi.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PURCHASE & RECEIVING */}
          {currentTab === "purchase" && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setPoSubTab("po_list")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    poSubTab === "po_list" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Purchase Orders ({purchaseOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPoSubTab("receiving_list")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    poSubTab === "receiving_list" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Receiving ({receivings.length})
                </button>
              </div>

              {poSubTab === "po_list" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Daftar Purchase Order</span>
                      <p className="text-[11px] text-slate-500">Pemesanan barang ke supplier rekanan</p>
                    </div>
                    {!isStaff && (
                      <button
                        type="button"
                        onClick={() => setIsCreatePoModalOpen(true)}
                        className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        + Buat PO Baru
                      </button>
                    )}
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">No PO</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5">Item Pesanan</th>
                        <th className="p-2.5">Total Nilai</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchaseOrders.map((po) => (
                        <tr key={po.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{po.poId || po.documentNo}</td>
                          <td className="p-2.5">{po.poDate}</td>
                          <td className="p-2.5 font-semibold text-slate-900">{po.supplier}</td>
                          <td className="p-2.5">
                            {(po.items || []).map((it: any, i: number) => (
                              <div key={i} className="text-[11px]">
                                • {it.itemName}: <b>{it.qty} pcs</b>
                              </div>
                            ))}
                          </td>
                          <td className="p-2.5 font-bold text-emerald-700">{formatRupiah(Number(po.total || 0))}</td>
                          <td className="p-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${po.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            {po.status === "OPEN" && (
                              <button
                                type="button"
                                onClick={() => handleOpenReceivingModal(po)}
                                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-semibold"
                              >
                                Terima Barang
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SUBTAB RECEIVING DENGAN TOMBOL HEADER TERIMA BARANG */}
              {poSubTab === "receiving_list" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Log Penerimaan Barang (Receiving)</span>
                      <p className="text-[11px] text-slate-500">Histori bukti penerimaan barang masuk ke gudang</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const openPos = purchaseOrders.filter((p) => p.status === "OPEN");
                        if (openPos.length === 0) {
                          return showAlert("Tidak ada Purchase Order (PO) yang berstatus OPEN untuk diproses receiving.");
                        }
                        setIsSelectPoForReceivingOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                    >
                      + Terima Barang (Proses PO)
                    </button>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">No Receiving</th>
                        <th className="p-2.5">Ref PO</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5">Barang Masuk</th>
                        <th className="p-2.5">Petugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receivings.map((r) => (
                        <tr key={r.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{r.receivingId}</td>
                          <td className="p-2.5 font-mono text-blue-700 font-bold">{r.poId}</td>
                          <td className="p-2.5">{r.date}</td>
                          <td className="p-2.5 font-medium">{r.supplier}</td>
                          <td className="p-2.5">
                            {(r.items || []).map((it: any, i: number) => (
                              <div key={i} className="text-[11px]">• {it.itemName}: <b>{it.qtyReceived} pcs</b></div>
                            ))}
                          </td>
                          <td className="p-2.5">{r.createdBy}</td>
                        </tr>
                      ))}
                      {receivings.length === 0 && (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-400">Belum ada riwayat penerimaan barang.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REPORTS */}
          {currentTab === "reports" && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-200 pb-2">
                {[
                  { key: "so", label: "Laporan SO" },
                  { key: "do", label: "Laporan DO" },
                  { key: "sales_item_day", label: "Sales by Item by Day" },
                  { key: "sales_summary_day", label: "Sales Summary by Day" },
                  { key: "customer", label: "Laporan Customer" },
                  { key: "stock", label: "Laporan Persediaan" },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setReportSubTab(st.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      reportSubTab === st.key ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                {/* REPORT SALES BY ITEM BY DAY */}
                {reportSubTab === "sales_item_day" && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 uppercase">Report Sales by Item by Day (Berbasis DO)</span>
                        <p className="text-[11px] text-slate-500">Rincian penjualan harian berdasarkan transaksi DO yang diterbitkan</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["Tanggal", "No DO", "No SO", "Pelanggan", "SKU", "Nama Barang", "Qty Pcs", "Harga Jual (Rp)", "Total Penjualan (Rp)"];
                            const rows = salesByItemByDayData.map((r) => [r.date, r.doId, r.soId, r.recipient, r.sku, r.itemName, `${r.qty} pcs`, r.price, r.subtotal]);
                            downloadPdf("Laporan Penjualan by Item by Day", "Sales_By_Item_By_Day", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["Tanggal", "No DO", "No SO", "Pelanggan", "SKU", "Nama Barang", "Qty Pcs", "Harga Jual (Rp)", "Total Penjualan (Rp)"];
                            const rows = salesByItemByDayData.map((r) => [r.date, r.doId, r.soId, r.recipient, r.sku, r.itemName, r.qty, r.price, r.subtotal]);
                            downloadExcel("ALL", "Sales_By_Item_By_Day", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor Excel
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">No DO</th>
                          <th className="p-2">Pelanggan</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Harga Satuan (Rp)</th>
                          <th className="p-2 text-right">Subtotal Penjualan (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {salesByItemByDayData.map((r, i) => (
                          <tr key={i}>
                            <td className="p-2">{r.date}</td>
                            <td className="p-2 font-mono font-bold text-slate-900">{r.doId}</td>
                            <td className="p-2">{r.recipient}</td>
                            <td className="p-2 font-mono">{r.sku}</td>
                            <td className="p-2 font-medium">{r.itemName}</td>
                            <td className="p-2 text-center font-bold">{r.qty}</td>
                            <td className="p-2 text-right">{formatRupiah(r.price)}</td>
                            <td className="p-2 text-right font-bold text-emerald-700">{formatRupiah(r.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* REPORT SALES SUMMARY BY DAY */}
                {reportSubTab === "sales_summary_day" && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 uppercase">Report Sales Summary by Day (Akumulasi Qty &amp; Nilai)</span>
                        <p className="text-[11px] text-slate-500">Rekapitulasi penjualan per produk per hari dari DO yang berhasil terbit</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["Tanggal", "SKU", "Nama Barang", "Total Kuantitas Terjual", "Total Nilai Penjualan (Rp)"];
                            const rows = salesSummaryByDayData.map((r) => [r.date, r.sku, r.itemName, `${r.totalQty} pcs`, r.totalNominal]);
                            downloadPdf("Laporan Ringkasan Penjualan by Day", "Sales_Summary_By_Day", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["Tanggal", "SKU", "Nama Barang", "Total Kuantitas Terjual", "Total Nilai Penjualan (Rp)"];
                            const rows = salesSummaryByDayData.map((r) => [r.date, r.sku, r.itemName, r.totalQty, r.totalNominal]);
                            downloadExcel("ALL", "Sales_Summary_By_Day", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor Excel
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Nama Barang</th>
                          <th className="p-2 text-center">Total Kuantitas Terjual</th>
                          <th className="p-2 text-right">Total Nilai Penjualan (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {salesSummaryByDayData.map((r, i) => (
                          <tr key={i}>
                            <td className="p-2">{r.date}</td>
                            <td className="p-2 font-mono font-bold text-slate-900">{r.sku}</td>
                            <td className="p-2 font-medium">{r.itemName}</td>
                            <td className="p-2 text-center font-bold">{r.totalQty} pcs</td>
                            <td className="p-2 text-right font-bold text-emerald-700">{formatRupiah(r.totalNominal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* LAPORAN SO */}
                {reportSubTab === "so" && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-900 uppercase">Rekapitulasi Sales Order</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["No SO", "Tanggal", "Customer", "Total Nilai (Rp)", "Status"];
                            const rows = salesOrders.map((so) => [so.soId, so.date, so.customerName, Number(so.total || 0), so.status]);
                            downloadPdf("Laporan Sales Order", "Laporan_SO", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["No SO", "Tanggal", "Customer", "Total Nilai (Rp)", "Status"];
                            const rows = salesOrders.map((so) => [so.soId, so.date, so.customerName, Number(so.total || 0), so.status]);
                            downloadExcel("ALL", "Laporan_SO", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor Excel
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">No SO</th>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Customer</th>
                          <th className="p-2">Total Nilai (Rp)</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {salesOrders.map((so) => (
                          <tr key={so.id}>
                            <td className="p-2 font-mono font-bold">{so.soId}</td>
                            <td className="p-2">{so.date}</td>
                            <td className="p-2 font-medium">{so.customerName}</td>
                            <td className="p-2 font-bold text-emerald-700">{formatRupiah(Number(so.total || 0))}</td>
                            <td className="p-2 font-bold">{so.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* LAPORAN DO DENGAN TOTAL NILAI */}
                {reportSubTab === "do" && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-900 uppercase">Rekapitulasi Delivery Order</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["No DO", "Ref SO", "Tanggal", "Penerima", "Total Pcs", "Total Nilai (Rp)", "Ekspedisi"];
                            const rows = deliveryOrders.map((d) => [
                              d.doId,
                              d.soId,
                              d.date,
                              d.recipientName,
                              `${d.totalPcs} pcs`,
                              (d.items || []).reduce((acc: number, it: any) => acc + (Number(it.subtotal) || (Number(it.qty || 1) * Number(it.price || 0))), 0),
                              d.expedition,
                            ]);
                            downloadPdf("Laporan Delivery Order", "Laporan_DO", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["No DO", "Ref SO", "Tanggal", "Penerima", "Total Pcs", "Total Nilai (Rp)", "Ekspedisi"];
                            const rows = deliveryOrders.map((d) => [
                              d.doId,
                              d.soId,
                              d.date,
                              d.recipientName,
                              d.totalPcs,
                              (d.items || []).reduce((acc: number, it: any) => acc + (Number(it.subtotal) || (Number(it.qty || 1) * Number(it.price || 0))), 0),
                              d.expedition,
                            ]);
                            downloadExcel("ALL", "Laporan_DO", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor Excel
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">No DO</th>
                          <th className="p-2">Ref SO</th>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Penerima</th>
                          <th className="p-2">Total Pcs</th>
                          <th className="p-2">Total Nilai Penjualan (Rp)</th>
                          <th className="p-2">Ekspedisi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveryOrders.map((d) => {
                          const totalNilaiDo = (d.items || []).reduce((acc: number, it: any) => acc + (Number(it.subtotal) || (Number(it.qty || 1) * Number(it.price || 0))), 0);
                          return (
                            <tr key={d.id}>
                              <td className="p-2 font-mono font-bold">{d.doId}</td>
                              <td className="p-2 font-mono">{d.soId}</td>
                              <td className="p-2">{d.date}</td>
                              <td className="p-2 font-medium">{d.recipientName}</td>
                              <td className="p-2 font-bold">{d.totalPcs} pcs</td>
                              <td className="p-2 font-bold text-emerald-700">{formatRupiah(totalNilaiDo)}</td>
                              <td className="p-2">{d.expedition}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* LAPORAN PERSEDIAAN */}
                {reportSubTab === "stock" && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-900 uppercase">Laporan Saldo Persediaan Produk &amp; Nilai Aset</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportAllProducts("pdf")}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportAllProducts("excel")}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor Excel
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Nama Produk</th>
                          <th className="p-2">Stok Fisik</th>
                          <th className="p-2">HPP (Beli)</th>
                          <th className="p-2">Total Saldo Nilai (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map((p) => {
                          const stock = Number(p.stock || 0);
                          const hpp = Number(p.purchasingPrice || 0);
                          const totalNilai = stock * hpp;
                          return (
                            <tr key={p.id}>
                              <td className="p-2 font-mono font-bold">{p.sku}</td>
                              <td className="p-2 font-medium">{p.itemName}</td>
                              <td className="p-2 font-bold text-emerald-700">{stock} pcs</td>
                              <td className="p-2">{formatRupiah(hpp)}</td>
                              <td className="p-2 font-bold text-emerald-800">{formatRupiah(totalNilai)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* LAPORAN CUSTOMER */}
                {reportSubTab === "customer" && (
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-900 uppercase">Rekapitulasi Data Customer Terdaftar</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["ID Customer", "Nama", "Telepon", "Email", "Alamat Lengkap"];
                            const rows = customers.map((c) => [c.customerId || c.id, c.customerName, c.phone || "-", c.email || "-", c.displayAddress || c.address || "-"]);
                            downloadPdf("Laporan Data Customer", "Laporan_Customer", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const headers = ["ID Customer", "Nama", "Telepon", "Email", "Alamat Lengkap"];
                            const rows = customers.map((c) => [c.customerId || c.id, c.customerName, c.phone || "-", c.email || "-", c.displayAddress || c.address || "-"]);
                            downloadExcel("ALL", "Laporan_Customer", headers, rows);
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Ekspor Excel
                        </button>
                      </div>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">ID Customer</th>
                          <th className="p-2">Nama</th>
                          <th className="p-2">Telepon</th>
                          <th className="p-2">Alamat Pengiriman</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customers.map((c) => (
                          <tr key={c.id}>
                            <td className="p-2 font-mono font-bold">{c.customerId || c.id}</td>
                            <td className="p-2 font-semibold">{c.customerName}</td>
                            <td className="p-2 font-mono">{c.phone || "-"}</td>
                            <td className="p-2 max-w-sm truncate">{c.displayAddress || c.address || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {currentTab === "settings" && (
            <div className="max-w-3xl bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
              {/* PRINTER BLUETOOTH */}
              <div className="border-b border-slate-200 pb-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase">Konfigurasi Printer Thermal Bluetooth</h3>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-600">Perangkat Bluetooth:</span>
                    <div className="font-bold text-slate-900 mt-0.5">{storeSettings.btPrinterDeviceName || btStatus}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
                        return showAlert("Browser tidak mendukung Web Bluetooth.");
                      }
                      try {
                        const device = await (navigator as any).bluetooth.requestDevice({
                          acceptAllDevices: true,
                          optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb", "49535343-fe7d-4ae5-8fa9-9fafd205e455"],
                        });
                        setBtPrintDevice(device);
                        setBtStatus(`Terhubung: ${device.name || "Bluetooth Printer"}`);
                        setStoreSettings((prev) => ({ ...prev, btPrinterDeviceName: device.name || "Bluetooth Printer" }));
                        showAlert(`Printer [${device.name}] berhasil terhubung.`);
                      } catch {
                        setBtStatus("Koneksi dibatalkan");
                      }
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold"
                  >
                    Pindai &amp; Hubungkan Printer
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ukuran Kertas Label</label>
                    <select
                      value={storeSettings.labelSize}
                      onChange={(e) => setStoreSettings({ ...storeSettings, labelSize: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                    >
                      <option value="58mm">58mm (Mini Thermal)</option>
                      <option value="80mm">80mm (Standard)</option>
                      <option value="100mm">100mm (Label Resi)</option>
                    </select>
                  </div>
                  <div className="pt-5">
                    <button
                      type="button"
                      disabled={!isBluetoothSettingsChanged}
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await setDoc(doc(db, "settings", "store_info"), storeSettings, { merge: true });
                          setSavedSettings(storeSettings);
                          showAlert("Pengaturan printer berhasil disimpan.");
                        } catch (e: any) {
                          showAlert(e.message || "Gagal menyimpan.");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg"
                    >
                      Simpan Pengaturan Printer
                    </button>
                  </div>
                </div>
              </div>

              {/* ALAMAT ASAL TOKO BERJENJANG */}
              <div className="border-b border-slate-200 pb-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 uppercase">Alamat Asal Toko (Hierarki Wilayah)</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!storeSettings.provinceName || !storeSettings.regencyName || !storeSettings.districtName || !storeSettings.villageName) {
                      return showAlert("Pilih hierarki wilayah lengkap (Provinsi hingga Desa/Kelurahan)!");
                    }
                    const fullAddr = `${storeSettings.detailAddress ? storeSettings.detailAddress.trim() + ", " : ""}Desa/Kel. ${storeSettings.villageName}, Kec. ${storeSettings.districtName}, ${storeSettings.regencyName}, ${storeSettings.provinceName}`;
                    try {
                      setLoading(true);
                      await setDoc(doc(db, "settings", "store_info"), {
                        ...storeSettings,
                        storeAddress: fullAddr,
                        updatedAt: serverTimestamp(),
                        updatedBy: currentUser.name || "Administrator",
                      }, { merge: true });
                      setStoreSettings((prev) => ({ ...prev, storeAddress: fullAddr }));
                      setSavedSettings({ ...storeSettings, storeAddress: fullAddr });
                      showAlert("Alamat asal toko berhasil disimpan.");
                      loadAllData();
                    } catch (err: any) {
                      showAlert(err.message || "Gagal menyimpan alamat toko.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Nama Toko</label>
                      <input
                        type="text"
                        required
                        value={storeSettings.storeName}
                        onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">No. Handphone Toko</label>
                      <input
                        type="text"
                        required
                        value={storeSettings.storePhone}
                        onChange={(e) => setStoreSettings({ ...storeSettings, storePhone: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">1. Provinsi</label>
                      <select
                        required
                        value={storeSettings.provinceCode}
                        onChange={async (e) => {
                          const pCode = e.target.value;
                          const prov = provinces.find((p) => p.id === pCode);
                          setStoreSettings((prev) => ({
                            ...prev,
                            provinceCode: pCode,
                            provinceName: prov?.name || "",
                            regencyCode: "",
                            regencyName: "",
                            districtCode: "",
                            districtName: "",
                            villageCode: "",
                            villageName: "",
                          }));
                          setRegencies([]);
                          setDistricts([]);
                          setVillages([]);
                          if (!pCode) return;
                          setLoadingRegion(true);
                          try {
                            const res = await fetch(`/api/regions?type=regencies&code=${pCode}`);
                            const data = await res.json();
                            if (Array.isArray(data)) setRegencies(data);
                          } finally { setLoadingRegion(false); }
                        }}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none"
                      >
                        <option value="">-- Pilih Provinsi --</option>
                        {provinces.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">2. Kabupaten/Kota</label>
                      <select
                        required
                        disabled={!storeSettings.provinceCode || regencies.length === 0}
                        value={storeSettings.regencyCode}
                        onChange={async (e) => {
                          const rCode = e.target.value;
                          const reg = regencies.find((r) => r.id === rCode);
                          setStoreSettings((prev) => ({
                            ...prev,
                            regencyCode: rCode,
                            regencyName: reg?.name || "",
                            districtCode: "",
                            districtName: "",
                            villageCode: "",
                            villageName: "",
                          }));
                          setDistricts([]);
                          setVillages([]);
                          if (!rCode) return;
                          setLoadingRegion(true);
                          try {
                            const res = await fetch(`/api/regions?type=districts&code=${rCode}`);
                            const data = await res.json();
                            if (Array.isArray(data)) setDistricts(data);
                          } finally { setLoadingRegion(false); }
                        }}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                      >
                        <option value="">-- Pilih Kab/Kota --</option>
                        {regencies.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">3. Kecamatan</label>
                      <select
                        required
                        disabled={!storeSettings.regencyCode || districts.length === 0}
                        value={storeSettings.districtCode}
                        onChange={async (e) => {
                          const dCode = e.target.value;
                          const dist = districts.find((d) => d.id === dCode);
                          setStoreSettings((prev) => ({
                            ...prev,
                            districtCode: dCode,
                            districtName: dist?.name || "",
                            villageCode: "",
                            villageName: "",
                          }));
                          setVillages([]);
                          if (!dCode) return;
                          setLoadingRegion(true);
                          try {
                            const res = await fetch(`/api/regions?type=villages&code=${dCode}`);
                            const data = await res.json();
                            if (Array.isArray(data)) setVillages(data);
                          } finally { setLoadingRegion(false); }
                        }}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                      >
                        <option value="">-- Pilih Kecamatan --</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">4. Desa/Kelurahan</label>
                      <select
                        required
                        disabled={!storeSettings.districtCode || villages.length === 0}
                        value={storeSettings.villageCode}
                        onChange={(e) => {
                          const vCode = e.target.value;
                          const vil = villages.find((v) => v.id === vCode);
                          setStoreSettings((prev) => ({ ...prev, villageCode: vCode, villageName: vil?.name || "" }));
                        }}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                      >
                        <option value="">-- Pilih Desa/Kel. --</option>
                        {villages.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Detail Jalan &amp; RT/RW</label>
                    <textarea
                      rows={2}
                      required
                      value={storeSettings.detailAddress}
                      onChange={(e) => setStoreSettings({ ...storeSettings, detailAddress: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={!isStoreAddressChanged}
                      className="px-4 py-2 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
                    >
                      Simpan Alamat Toko
                    </button>
                  </div>
                </form>
              </div>

                            {/* AUDIT PRIMARY KEY & ID INTEGRITY CHECK */}
              {isRootAdmin && (
                <div className="border-b border-slate-200 pb-5 space-y-3 text-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Audit Integritas Primary Key (ID Database)</h3>
                  <p className="text-slate-500">Pindai seluruh ID dokumen di semua koleksi untuk mendeteksi ID duplikat atau ganda.</p>
                  <button
                    type="button"
                    disabled={isAuditing}
                    onClick={handleRunAuditAllIds}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold rounded-lg shadow-xs"
                  >
                    {isAuditing ? "Memindai Seluruh Database..." : "🔍 Jalankan Audit Primary Key"}
                  </button>
                </div>
              )}

              {/* PENGATURAN API KEY RAJAONGKIR (UJI DULU BARU SIMPAN) */}
              {isRootAdmin && (
                <div className="space-y-3 text-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Pengaturan API Key RajaOngkir (Komerce)</h3>
                  <p className="text-slate-500">Uji koneksi terlebih dahulu. Tombol simpan hanya aktif jika pengujian berhasil.</p>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan API Key RajaOngkir..."
                      value={inputApiKey}
                      onChange={(e) => {
                        setInputApiKey(e.target.value);
                        setApiKeyTestedSuccess(false);
                      }}
                      className="flex-1 p-2 border border-slate-200 rounded-lg outline-none bg-white font-mono"
                    />
                    <button
                      type="button"
                      disabled={isTestingApiKey || !inputApiKey.trim()}
                      onClick={async () => {
                        setIsTestingApiKey(true);
                        setApiKeyTestedSuccess(false);
                        try {
                          const res = await fetch("/api/shipping/config", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "TEST_CONNECTION", apiKey: inputApiKey.trim(), userRole: currentUser.role }),
                          });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setApiKeyTestedSuccess(true);
                            showAlert("Uji koneksi berhasil! API Key valid dan siap disimpan.");
                          } else {
                            showAlert(data.message || "Uji koneksi gagal. Periksa kembali API Key Anda.");
                          }
                        } catch {
                          showAlert("Gagal menghubungi server pengujian.");
                        } finally {
                          setIsTestingApiKey(false);
                        }
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold rounded-lg"
                    >
                      {isTestingApiKey ? "Menguji..." : "Uji Koneksi"}
                    </button>
                    <button
                      type="button"
                      disabled={!apiKeyTestedSuccess || isSavingApiKey}
                      onClick={async () => {
                        setIsSavingApiKey(true);
                        try {
                          await setDoc(doc(db, "settings", "store_info"), { rajaOngkirApiKey: inputApiKey.trim() }, { merge: true });
                          setStoreSettings((prev) => ({ ...prev, rajaOngkirApiKey: inputApiKey.trim() }));
                          showAlert("API Key RajaOngkir berhasil disimpan permanen.");
                          setApiKeyTestedSuccess(false);
                        } catch (err: any) {
                          showAlert(err.message || "Gagal menyimpan API Key.");
                        } finally {
                          setIsSavingApiKey(false);
                        }
                      }}
                      className="px-4 py-2 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-xs"
                    >
                      {isSavingApiKey ? "Menyimpan..." : "Simpan API Key"}
                    </button>
                  </div>
                  {apiKeyTestedSuccess && (
                    <span className="text-[11px] text-emerald-700 font-bold block">✓ Kunci API terverifikasi dan siap disimpan.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: HUMAN (STAF, SUPPLIER, CUSTOMER) */}
          {currentTab === "human" && isRootAdmin && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setHumanSubTab("staff")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    humanSubTab === "staff" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Staf Gudang ({usersList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHumanSubTab("suppliers")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    humanSubTab === "suppliers" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Supplier Rekanan ({suppliers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHumanSubTab("customers")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    humanSubTab === "customers" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Daftar Pelanggan ({customers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHumanSubTab("families")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    humanSubTab === "families" ? "bg-[#9F1239] text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Family Produk ({families.length})
                </button>
              </div>

              {/* 7.1 STAF GUDANG CRUD LENGKAP */}
              {humanSubTab === "staff" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Akun Pengguna Staf</span>
                      <p className="text-[11px] text-slate-500">Akses operasional gudang dan manajemen akun tim</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenCreateStaff}
                      className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs transition"
                    >
                      + Tambah Staf Baru
                    </button>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">ID Staf</th>
                          <th className="p-2.5">User ID</th>
                          <th className="p-2.5">Nama Lengkap</th>
                          <th className="p-2.5">Role</th>
                          <th className="p-2.5 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersList.map((u, idx) => (
                          <tr key={u.id || idx} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-mono font-bold text-slate-900">{u.staffId || `ST-${String(idx + 1).padStart(2, "0")}`}</td>
                            <td className="p-2.5 font-mono font-medium text-slate-700">{u.userId || u.username || u.id}</td>
                            <td className="p-2.5 font-semibold text-slate-900">{u.fullName || u.name}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                String(u.role).includes("ROOT") ? "bg-amber-100 text-amber-800" :
                                String(u.role).includes("ADMIN") ? "bg-purple-100 text-purple-800" :
                                "bg-slate-100 text-slate-800"
                              }`}>
                                {u.role || "STAFF_GUDANG"}
                              </span>
                            </td>
                            <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenEditStaff(u)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded text-[11px] font-semibold"
                              >
                                Edit
                              </button>
                              {!String(u.role).includes("ROOT") && String(u.userId || u.id).toLowerCase() !== "admin" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(u)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold"
                                >
                                  Hapus
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {usersList.length === 0 && (
                          <tr><td colSpan={5} className="p-4 text-center text-slate-400">Belum ada data staf terdaftar.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7.2 SUPPLIER REKANAN */}
              {humanSubTab === "suppliers" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Supplier Rekanan</span>
                      <p className="text-[11px] text-slate-500">Katalog vendor pengadaan barang</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSupplier(null);
                        setIsSupplierModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      + Tambah Supplier Baru
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Kode</th>
                        <th className="p-2.5">Nama Supplier</th>
                        <th className="p-2.5">Telepon</th>
                        <th className="p-2.5">Alamat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {suppliers.map((s) => (
                        <tr key={s.id || s.supplierId}>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{s.supplierId || s.documentNo}</td>
                          <td className="p-2.5 font-semibold text-slate-900">{s.supplierName}</td>
                          <td className="p-2.5 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{s.phone || "-"}</span>
                              {s.phone && (
                                <button
                                  type="button"
                                  onClick={() => openWhatsAppChat(s.phone, s.supplierName, "SUPPLIER")}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold"
                                  title="Hubungi WhatsApp Supplier"
                                >
                                  WA
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">{s.address || "-"}</td>
                        </tr>
                      ))}
                      {suppliers.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-slate-400">Belum ada data supplier terdaftar.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

                            {/* 7.4 FAMILY PRODUK CRUD (FAM-xxx AUTO-INCREMENT) */}
              {humanSubTab === "families" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Kategori Family Produk (FAM-xxx)</span>
                      <p className="text-[11px] text-slate-500">Master pengelompokan produk dengan kode auto-increment berurutan</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenCreateFamily}
                      className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      + Tambah Family Baru
                    </button>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Kode Family</th>
                          <th className="p-2.5">Nama Family</th>
                          <th className="p-2.5">Jumlah SKU Terdaftar</th>
                          <th className="p-2.5 text-right">Tindakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {families.map((f) => {
                          const code = f.familyCode || f.id;
                          const count = products.filter((p) => p.familyCode === code).length;
                          return (
                            <tr key={code} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-mono font-bold text-slate-900">{code}</td>
                              <td className="p-2.5 font-semibold text-slate-900">{f.familyName || f.name}</td>
                              <td className="p-2.5 font-medium text-slate-600">{count} Produk</td>
                              <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditFamily(f)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded text-[11px] font-semibold"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFamily(f)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {families.length === 0 && (
                          <tr><td colSpan={4} className="p-4 text-center text-slate-400">Belum ada data Family Produk.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7.3 DAFTAR CUSTOMER */}
              {humanSubTab === "customers" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase">Master Data Pelanggan</span>
                      <p className="text-[11px] text-slate-500">Basis data alamat pengiriman berjenjang Indonesia</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerModalMode("create");
                        setCustomerForm({
                          customerId: "",
                          customerName: "",
                          phone: "",
                          email: "",
                          provinceCode: "",
                          provinceName: "",
                          regencyCode: "",
                          regencyName: "",
                          districtCode: "",
                          districtName: "",
                          villageCode: "",
                          villageName: "",
                          detailAddress: "",
                          postalCode: "",
                        });
                        setIsCustomerModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      + Tambah Pelanggan Baru
                    </button>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">ID Pelanggan</th>
                          <th className="p-2.5">Nama Lengkap</th>
                          <th className="p-2.5">No. Telepon / WA</th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Alamat Pengiriman Lengkap</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customers.map((c, idx) => {
                          const determinedId = c.customerId?.startsWith("CUST-") ? c.customerId : `CUST-${String(idx + 1).padStart(4, "0")}`;
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-mono font-bold text-slate-900">{determinedId}</td>
                              <td className="p-2.5 font-semibold text-slate-900">{c.customerName}</td>
                              <td className="p-2.5 font-mono">
                                <div className="flex items-center gap-1.5">
                                  <span>{c.phone || "-"}</span>
                                  {c.phone && (
                                    <button
                                      type="button"
                                      onClick={() => openWhatsAppChat(c.phone, c.customerName, "CUSTOMER")}
                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold"
                                      title="Hubungi WhatsApp Customer"
                                    >
                                      WA
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5">{c.email || "-"}</td>
                              <td className="p-2.5 max-w-sm truncate">{c.displayAddress || c.address || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* MODAL DETAIL SALES ORDER (SO) */}
      {isSoDetailModalOpen && selectedSoDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Detail Sales Order: {selectedSoDetail.soId}</h3>
                <span className="text-[11px] text-[#9F1239] font-semibold">Status: <b>{selectedSoDetail.status}</b></span>
              </div>
              <button
                type="button"
                onClick={() => setIsSoDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <div className="text-slate-500">Customer:</div>
                <div className="font-bold text-slate-900">{selectedSoDetail.customerName} ({selectedSoDetail.phone})</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{selectedSoDetail.address}</div>
              </div>
              <div>
                <div className="text-slate-500">Pengiriman:</div>
                <div className="font-bold">{selectedSoDetail.shippingServiceName || selectedSoDetail.expedition}</div>
                <div className="text-emerald-700 font-bold">Ongkir: {formatRupiah(Number(selectedSoDetail.shippingCost || 0))}</div>
                <div className="text-[#9F1239] font-bold text-sm mt-0.5">Total: {formatRupiah(Number(selectedSoDetail.total || 0))}</div>
              </div>
            </div>

            <div className="mb-4">
              <span className="font-bold text-slate-900 block mb-2">Rincian SKU Barang:</span>
              <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Nama Barang</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Harga</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedSoDetail.items || []).map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 font-mono font-bold text-slate-900">{it.sku}</td>
                      <td className="p-2">{it.itemName}</td>
                      <td className="p-2 text-center font-bold">{it.qty || it.quantity}</td>
                      <td className="p-2 text-right">{formatRupiah(Number(it.price || 0))}</td>
                      <td className="p-2 text-right font-bold text-emerald-700">{formatRupiah(Number(it.subtotal || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const msg = buildWhatsAppMessage(selectedSoDetail);
                  const clean = String(selectedSoDetail.phone || "").replace(/[^0-9]/g, "");
                  const phoneNum = clean.startsWith("0") ? "62" + clean.slice(1) : clean;
                  window.open(`https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-xs"
              >
                Kirim WhatsApp
              </button>

              {selectedSoDetail.status === "CONFIRMED" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSoId(selectedSoDetail.soId || selectedSoDetail.id);
                      setSoModalInitCustomer({
                        customerName: selectedSoDetail.customerName,
                        phone: selectedSoDetail.phone,
                        displayAddress: selectedSoDetail.address,
                      });
                      setSoModalInitItems(selectedSoDetail.items || []);
                      setSoModalInitRates(selectedSoDetail.shippingRatesSnapshot || []);
                      setSoModalInitCost(selectedSoDetail.shippingCost || 0);
                      setSoModalInitCourier(selectedSoDetail.shippingCourier || "KURIR_TOKO");
                      setSoModalInitService(selectedSoDetail.shippingServiceName || "Kurir Toko (Tarif Manual)");
                      setIsSoDetailModalOpen(false);
                      setIsSoModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                  >
                    Edit SO
                  </button>
                  <button
                    type="button"
                    onClick={() => executeMarkProcessing(selectedSoDetail)}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-xs"
                  >
                    Set PROCESSING
                  </button>
                </>
              )}

              {selectedSoDetail.status === "PROCESSING" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      let rates = selectedSoDetail.shippingRatesSnapshot || [];
                      if (!rates || rates.length === 0) {
                        rates = [{ courier: selectedSoDetail.shippingCourier || "KURIR_TOKO", serviceName: selectedSoDetail.shippingServiceName || "Kurir Toko (Tarif Manual)", cost: Number(selectedSoDetail.shippingCost || 0), etd: "1 Hari" }];
                      }
                      setTargetProcessingSo({ ...selectedSoDetail, shippingRatesSnapshot: rates });
                      setIsEditExpeditionModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg"
                  >
                    Ganti Ekspedisi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkReadyToDeliver(selectedSoDetail)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                  >
                    Set READY TO DELIVER
                  </button>
                </>
              )}

              {selectedSoDetail.status === "READY TO DELIVER" && (
                <button
                  type="button"
                  onClick={() => handleProcessDO(selectedSoDetail)}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-xs"
                >
                  Terbitkan Delivery Order (DO)
                </button>
              )}

              {selectedSoDetail.status !== "CANCELLED" && selectedSoDetail.status !== "DELIVERY ORDER" && (
                <button
                  type="button"
                  onClick={() => {
                    setSoCancelTarget(selectedSoDetail);
                    setSoCancelReason("");
                    setIsSoCancelConfirmOpen(true);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Batalkan SO
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL GANTI EKSPEDISI DARI SNAPSHOT (PROCESSING) */}
      {isEditExpeditionModalOpen && targetProcessingSo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Ganti Ekspedisi (Snapshot SO)</h3>
            <p className="text-[11px] text-slate-500 mb-3">SO: {targetProcessingSo.soId}</p>

            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
              {(targetProcessingSo.shippingRatesSnapshot || []).map((r: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => {
                    setTargetProcessingSo({
                      ...targetProcessingSo,
                      shippingCost: r.cost,
                      shippingCourier: r.courier,
                      shippingServiceName: r.serviceName,
                    });
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer flex justify-between items-center ${
                    targetProcessingSo.shippingServiceName === r.serviceName ? "bg-[#9F1239] text-white font-bold" : "bg-white border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <div>
                    <div>{r.serviceName}</div>
                    <div className="text-[10px] opacity-80">Estimasi: {r.etd || "-"}</div>
                  </div>
                  <div className="font-bold">{formatRupiah(r.cost)}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setIsEditExpeditionModalOpen(false)} className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold">Tutup</button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    const subtotalOnly = (targetProcessingSo.items || []).reduce((acc: number, it: any) => acc + (Number(it.subtotal) || 0), 0);
                    const newTotal = subtotalOnly + (Number(targetProcessingSo.shippingCost) || 0);

                    await updateDoc(doc(db, "sales_orders", targetProcessingSo.soId || targetProcessingSo.id), {
                      shippingCost: targetProcessingSo.shippingCost || 0,
                      shippingCourier: targetProcessingSo.shippingCourier || "",
                      shippingServiceName: targetProcessingSo.shippingServiceName || "",
                      expedition: targetProcessingSo.shippingServiceName || "",
                      total: newTotal,
                      updatedAt: serverTimestamp(),
                      updatedBy: currentUser.name || currentUser.id,
                    });

                    showAlert(`Ekspedisi SO [${targetProcessingSo.soId}] berhasil diubah.`);
                    setIsEditExpeditionModalOpen(false);
                    setTargetProcessingSo(null);
                    setIsSoDetailModalOpen(false);
                    loadAllData();
                  } catch (err: any) {
                    showAlert(err.message || "Gagal mengubah ekspedisi.");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-4 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white rounded text-xs font-semibold"
              >
                Simpan Ekspedisi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEMBATALAN SO */}
      {isSoCancelConfirmOpen && soCancelTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl border border-rose-200 text-xs">
            <h3 className="text-sm font-bold text-rose-950 mb-1">Batalkan Sales Order</h3>
            <p className="text-[11px] text-slate-500 font-mono mb-3">No SO: {soCancelTarget.soId}</p>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Pembatalan (Wajib):</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ketik alasan pembatalan SO..."
                  value={soCancelReason}
                  onChange={(e) => setSoCancelReason(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-slate-50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsSoCancelConfirmOpen(false)} className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold">Tutup</button>
                <button type="button" onClick={executeCancelSo} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold">Konfirmasi Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PILIH PO UNTUK PROSES RECEIVING */}
      {isSelectPoForReceivingOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[80] animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-lg p-5 shadow-xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Pilih Dokumen PO yang Diterima</h3>
              <button type="button" onClick={() => setIsSelectPoForReceivingOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">&times;</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {purchaseOrders.filter((p) => p.status === "OPEN").map((po) => (
                <div
                  key={po.id}
                  onClick={() => handleOpenReceivingModal(po)}
                  className="p-3 border border-slate-200 rounded-lg hover:border-[#9F1239] hover:bg-rose-50/20 cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-slate-900">{po.poId || po.documentNo}</div>
                    <div className="text-[11px] text-slate-500">Supplier: {po.supplier} • {po.poDate}</div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-700 text-white rounded font-semibold text-[11px]">Proses</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EXTERNAL COMPONENT MODALS */}
      <ProductModal
        isOpen={isProductModalOpen}
        isEditing={isEditingProduct}
        families={families}
        suppliers={suppliers}
        initialData={productFormData}
        onClose={() => setIsProductModalOpen(false)}
        onConfirmSave={handleSaveProduct}
      />

      <SalesOrderModal
        isOpen={isSoModalOpen}
        editingSoId={editingSoId}
        customers={customers}
        products={products}
        storeOriginId={storeSettings.defaultOriginId || 4997}
        initialCustomer={soModalInitCustomer}
        initialItems={soModalInitItems}
        initialRates={soModalInitRates}
        initialCost={soModalInitCost}
        initialCourier={soModalInitCourier}
        initialService={soModalInitService}
        onClose={() => setIsSoModalOpen(false)}
        onSaveSo={async (payload: any) => {
          try {
            setLoading(true);
            const { editingSoId, selectedCustomer, soItems, shippingRates, shippingCost, courierCode, serviceName } = payload;
            const today = new Date();
            const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
            const displayDate = today.toISOString().split("T")[0];

            const subtotal = soItems.reduce((acc: number, it: any) => acc + it.subtotal, 0);
            const totalWeight = soItems.reduce((acc: number, it: any) => acc + (it.weightInGrams || 0) * it.qty, 0);
            const grandTotal = subtotal + shippingCost;
            const addr = selectedCustomer.displayAddress || selectedCustomer.address || "-";

            if (editingSoId) {
              await updateDoc(doc(db, "sales_orders", editingSoId), {
                customerName: selectedCustomer.customerName,
                phone: selectedCustomer.phone || "-",
                address: addr,
                items: soItems,
                total: grandTotal,
                totalWeightInGrams: totalWeight,
                shippingCost: shippingCost,
                shippingCourier: courierCode,
                shippingServiceName: serviceName,
                shippingRatesSnapshot: shippingRates,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.name || currentUser.id,
              });
              showAlert(`Sales Order [${editingSoId}] berhasil diperbarui.`);
            } else {
              const counterRef = doc(db, "counters", "sales_order");
              const newSoId = await runTransaction(db, async (tx) => {
                const cSnap = await tx.get(counterRef);
                const curr = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
                const next = curr + 1;
                const genSoId = `SO-${dateStr}-${String(next).padStart(5, "0")}`;

                tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() }, { merge: true });
                tx.set(doc(db, "sales_orders", genSoId), {
                  soId: genSoId,
                  date: displayDate,
                  customerId: selectedCustomer.customerId || selectedCustomer.id || "",
                  customerName: selectedCustomer.customerName,
                  phone: selectedCustomer.phone || "-",
                  address: addr,
                  expedition: serviceName || "Kurir Toko",
                  items: soItems,
                  total: grandTotal,
                  totalWeightInGrams: totalWeight,
                  shippingCost: shippingCost,
                  shippingCourier: courierCode,
                  shippingServiceName: serviceName,
                  shippingRatesSnapshot: shippingRates,
                  status: "CONFIRMED",
                  cancelReason: "",
                  createdBy: currentUser.name || currentUser.id,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                return genSoId;
              });
              showAlert(`Sales Order [${newSoId}] berhasil dibuat.`);
            }
            setIsSoModalOpen(false);
            loadAllData();
          } catch (e: any) {
            showAlert(e.message || "Gagal memproses Sales Order.");
          } finally {
            setLoading(false);
          }
        }}
        showAlert={showAlert}
      />

      <StockAdjustmentModal
        isOpen={isAdjModalOpen}
        products={products}
        onClose={() => setIsAdjModalOpen(false)}
        onExecuteAdjustment={handleExecuteStockAdjustment}
        showAlert={showAlert}
      />

      <StockOpnameModal
        isOpen={isInitSopModalOpen}
        products={products}
        families={families}
        currentUserName={currentUser.name}
        onClose={() => setIsInitSopModalOpen(false)}
        onConfirmInit={handleConfirmInitStockOpname}
        showAlert={showAlert}
      />

      <CreatePurchaseOrderModal
        isOpen={isCreatePoModalOpen}
        products={products}
        suppliers={suppliers}
        onClose={() => setIsCreatePoModalOpen(false)}
        onSubmitPo={handleSavePurchaseOrder}
        showAlert={showAlert}
      />

      <SupplierModal
        isOpen={isSupplierModalOpen}
        isEditing={Boolean(editingSupplier)}
        initialData={editingSupplier}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        onSave={async (formData: any) => {
          try {
            setLoading(true);
            if (editingSupplier) {
              await updateDoc(doc(db, "suppliers", editingSupplier.supplierId || editingSupplier.id), {
                ...formData,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.name,
              });
            } else {
              const counterRef = doc(db, "counters", "supplier");
              await runTransaction(db, async (tx) => {
                const cSnap = await tx.get(counterRef);
                const curr = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
                const next = curr + 1;
                const genId = `SUPP-${String(next).padStart(4, "0")}`;
                tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() }, { merge: true });
                tx.set(doc(db, "suppliers", genId), {
                  ...formData,
                  supplierId: genId,
                  documentNo: genId,
                  active: true,
                  createdAt: serverTimestamp(),
                  createdBy: currentUser.name,
                });
              });
            }
            setIsSupplierModalOpen(false);
            loadAllData();
          } catch (err: any) {
            showAlert(err.message || "Gagal menyimpan data supplier.");
          } finally {
            setLoading(false);
          }
        }}
      />

      {/* MODAL KARTU MUTASI DETAIL */}
      {selectedProductLedger && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-3xl p-6 shadow-xl border border-slate-200 max-h-[88vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Kartu Mutasi Produk: {selectedProductLedger.sku}</h3>
                <p className="text-slate-500">{selectedProductLedger.itemName} • Saldo Fisik Terkini: <b>{selectedProductLedger.stock || 0} pcs</b></p>
              </div>
              <button type="button" onClick={() => setSelectedProductLedger(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                &times;
              </button>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">Tipe</th>
                  <th className="p-2">No. Referensi</th>
                  <th className="p-2 text-right">Masuk</th>
                  <th className="p-2 text-right">Keluar</th>
                  <th className="p-2 text-right">Saldo Akhir</th>
                  <th className="p-2">Keterangan</th>
                  <th className="p-2">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedProductMovements.map((m, idx) => (
                  <tr key={idx}>
                    <td className="p-2">{m.date}</td>
                    <td className="p-2 font-bold">{m.type}</td>
                    <td className="p-2 font-mono text-slate-700">{m.referenceId}</td>
                    <td className="p-2 text-right text-emerald-700 font-bold">{m.qtyIn > 0 ? `+${m.qtyIn}` : "-"}</td>
                    <td className="p-2 text-right text-rose-700 font-bold">{m.qtyOut > 0 ? `-${m.qtyOut}` : "-"}</td>
                    <td className="p-2 text-right font-bold text-slate-900">{m.newStock}</td>
                    <td className="p-2 text-[11px] text-slate-500">{m.reason || "-"}</td>
                    <td className="p-2">{m.user}</td>
                  </tr>
                ))}
                {selectedProductMovements.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-400">Belum ada riwayat mutasi untuk produk ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETAIL / REVIEW SOP */}
      {isSopReviewModalOpen && reviewSopTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-4xl p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Detail &amp; Review Hasil Stock Opname</h3>
                <p className="text-slate-500">Dokumen: {reviewSopTarget.documentNo || reviewSopTarget.sopId} • Status: <b>{reviewSopTarget.status}</b></p>
              </div>
              <button type="button" onClick={() => setIsSopReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                &times;
              </button>
            </div>

            <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden mb-4">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Nama Produk</th>
                  <th className="p-2 text-center">Qty Sistem</th>
                  <th className="p-2 text-center w-28">Qty Fisik (Penyesuaian)</th>
                  <th className="p-2 text-center">Selisih</th>
                  <th className="p-2">Dihitung Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviewItemsData.map((it, idx) => {
                  const sys = Number(it.systemQtySnapshot || 0);
                  const phys = it.physicalQty != null ? Number(it.physicalQty) : sys;
                  const diff = phys - sys;
                  return (
                    <tr key={idx}>
                      <td className="p-2 font-mono font-bold text-slate-900">{it.skuCode || it.skuId || it.sku}</td>
                      <td className="p-2 font-medium">{it.itemName}</td>
                      <td className="p-2 text-center font-bold">{sys} pcs</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          disabled={reviewSopTarget.status !== "COUNTING_COMPLETED"}
                          value={phys}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setReviewItemsData((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, physicalQty: val } : item))
                            );
                          }}
                          className="w-20 p-1 border border-slate-200 rounded text-center font-bold outline-none bg-slate-50 disabled:bg-slate-100"
                        />
                      </td>
                      <td className={`p-2 text-center font-bold ${diff > 0 ? "text-emerald-700" : diff < 0 ? "text-rose-700" : "text-slate-500"}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td className="p-2 text-slate-500">{it.countedBy || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <div>
                {reviewSopTarget.status !== "POSTED" && reviewSopTarget.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={handleCancelSopFromReview}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs"
                  >
                    Batalkan Dokumen SOP
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSopReviewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200"
                >
                  Tutup
                </button>
                {reviewSopTarget.status === "COUNTING_COMPLETED" && (
                  <button
                    type="button"
                    onClick={handleCompleteSopReview}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-xs"
                  >
                    Selesai Review (Set COMPLETED_REVIEW)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROSES RECEIVING BERDASARKAN PO */}
      {isReceivingModalOpen && selectedPoForReceiving && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Proses Penerimaan Barang (Receiving)</h3>
                <p className="text-slate-500">Ref PO: {selectedPoForReceiving.poId || selectedPoForReceiving.documentNo} • Supplier: <b>{selectedPoForReceiving.supplier}</b></p>
              </div>
              <button type="button" onClick={() => setIsReceivingModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                &times;
              </button>
            </div>

            <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden mb-4">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Nama Barang</th>
                  <th className="p-2 text-center">Qty Dipesan (PO)</th>
                  <th className="p-2 text-center w-32">Qty Diterima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedPoForReceiving.items || []).map((it: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-2 font-mono font-bold text-slate-900">{it.sku}</td>
                    <td className="p-2 font-medium">{it.itemName}</td>
                    <td className="p-2 text-center font-bold text-slate-700">{it.qty} pcs</td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max={it.qty}
                        value={receivingInputs[it.sku] ?? it.qty}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setReceivingInputs((prev) => ({ ...prev, [it.sku]: val }));
                        }}
                        className="w-24 p-1 border border-slate-200 rounded text-center font-bold outline-none bg-slate-50 font-mono text-emerald-800"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReceivingModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReceiving}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-xs"
              >
                Konfirmasi Penerimaan Barang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH/EDIT CUSTOMER */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {customerModalMode === "create" ? "Tambah Pelanggan Baru" : `Edit Data Pelanggan (${customerForm.customerId})`}
                </h3>
                <p className="text-[11px] text-slate-500">Basis data alamat pengiriman berjenjang Indonesia</p>
              </div>
              {loadingCustRegion && <span className="text-[10px] text-[#9F1239] font-semibold animate-pulse">Memuat data wilayah...</span>}
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Nama Lengkap Pelanggan *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Pelanggan"
                  value={customerForm.customerName}
                  onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">No. Telepon / WA</label>
                  <input
                    type="text"
                    placeholder="08xxxxxxxx"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Email</label>
                  <input
                    type="email"
                    placeholder="pelanggan@domain.com"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                <span className="font-bold text-slate-800 block text-[11px]">Alamat Wilayah Pengiriman *</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">1. Provinsi</label>
                    <select
                      required
                      value={customerForm.provinceCode}
                      onChange={(e) => handleCustProvinceChange(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg bg-white outline-none"
                    >
                      <option value="">-- Pilih Provinsi --</option>
                      {provinces.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">2. Kabupaten/Kota</label>
                    <select
                      required
                      disabled={!customerForm.provinceCode || custRegencies.length === 0}
                      value={customerForm.regencyCode}
                      onChange={(e) => handleCustRegencyChange(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Kab/Kota --</option>
                      {custRegencies.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">3. Kecamatan</label>
                    <select
                      required
                      disabled={!customerForm.regencyCode || custDistricts.length === 0}
                      value={customerForm.districtCode}
                      onChange={(e) => handleCustDistrictChange(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Kecamatan --</option>
                      {custDistricts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">4. Desa/Kelurahan</label>
                    <select
                      required
                      disabled={!customerForm.districtCode || custVillages.length === 0}
                      value={customerForm.villageCode}
                      onChange={(e) => handleCustVillageChange(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                    >
                      <option value="">-- Pilih Desa/Kel. --</option>
                      {custVillages.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Detail Alamat (Jalan, RT/RW, Patokan)</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Jl. Raya Barat No. 45 RT 02/03"
                    value={customerForm.detailAddress}
                    onChange={(e) => setCustomerForm({ ...customerForm, detailAddress: e.target.value })}
                    className="w-full p-1.5 border border-slate-200 rounded-lg outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Kode Pos</label>
                  <input
                    type="text"
                    placeholder="40377"
                    value={customerForm.postalCode}
                    onChange={(e) => setCustomerForm({ ...customerForm, postalCode: e.target.value })}
                    className="w-full p-1.5 border border-slate-200 rounded-lg outline-none bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white font-semibold rounded-lg"
                >
                  {customerModalMode === "create" ? "Simpan Pelanggan" : "Perbarui Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

                  {/* MODAL FORM TAMBAH / EDIT STAF GUDANG */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {staffModalMode === "create" ? "Tambah Akun Staf Baru" : `Edit Profil Staf [${staffForm.staffId}]`}
                </h3>
                <p className="text-[11px] text-slate-500">Kelola kredensial dan hak akses staf gudang</p>
              </div>
              <button
                type="button"
                onClick={handleCloseStaffModal}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">ID Staf (Auto-Increment)</label>
                <input
                  type="text"
                  disabled
                  value={staffForm.staffId}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 font-mono font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">User ID (Username Login) *</label>
                <input
                  type="text"
                  required
                  disabled={staffModalMode === "edit"}
                  placeholder="misal: ahmad_gudang"
                  value={staffForm.userId}
                  onChange={(e) => setStaffForm({ ...staffForm, userId: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white font-mono outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Staf"
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Hak Akses / Role *</label>
                <select
                  value={(staffForm as any).role || "STAFF_GUDANG"}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value } as any)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none font-medium"
                >
                  <option value="STAFF_GUDANG">STAFF_GUDANG (Operator)</option>
                  <option value="ADMIN_GUDANG">ADMIN_GUDANG (Supervisor)</option>
                </select>
              </div>

              {staffModalMode === "create" && (
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">Password Akun *</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimal 6 karakter"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseStaffModal}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white font-semibold rounded-lg shadow-xs"
                >
                  {staffModalMode === "create" ? "Simpan Staf" : "Perbarui Profil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CRUD FAMILY PRODUK */}
      {isFamilyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {familyModalMode === "create" ? "Tambah Family Baru" : `Edit Family [${familyForm.familyCode}]`}
              </h3>
              <button type="button" onClick={() => setIsFamilyModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleSaveFamily} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Kode Family (Auto-Increment)</label>
                <input
                  type="text"
                  disabled
                  value={familyForm.familyCode}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 font-mono font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Nama Family *</label>
                <input
                  type="text"
                  required
                  placeholder="misal: Kerudung Segiempat"
                  value={familyForm.familyName}
                  onChange={(e) => setFamilyForm({ ...familyForm, familyName: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsFamilyModalOpen(false)} className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold">Batal</button>
                <button type="submit" className="px-4 py-1.5 bg-[#9F1239] hover:bg-[#881337] text-white font-semibold rounded-lg shadow-xs">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LAPORAN AUDIT PRIMARY KEY & AKSI DEDUPLIKASI */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Laporan Integritas Primary Key Database</h3>
                <p className="text-[11px] text-slate-500">Hasil pemindaian keunikan ID dokumen di seluruh koleksi sistem</p>
              </div>
              <button type="button" onClick={() => setIsAuditModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">&times;</button>
            </div>

            <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden mb-4">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2">Koleksi</th>
                  <th className="p-2 text-center">Total Dokumen</th>
                  <th className="p-2 text-center">ID Ganda</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditReport.map((rep, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2 font-semibold text-slate-900">{rep.collectionLabel} <span className="font-mono text-slate-400 text-[10px]">({rep.collectionName})</span></td>
                    <td className="p-2 text-center font-bold">{rep.totalRecords}</td>
                    <td className="p-2 text-center font-bold text-rose-700">{rep.duplicateCount}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rep.status === "VALID" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                        {rep.status === "VALID" ? "Semua ID Unik" : "Duplikat Terdeteksi"}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {rep.duplicateCount > 0 ? (
                        <div className="space-y-1">
                          {rep.duplicateIds.map((dupId: string) => (
                            <button
                              key={dupId}
                              type="button"
                              onClick={() => handleDeleteDuplicateRecord(rep.collectionName, dupId)}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-semibold block ml-auto"
                            >
                              Hapus Salinan: {dupId}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200"
              >
                Tutup Laporan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT DIALOG DENGAN Z-INDEX MAKSIMAL (Z-[99999] AGAR TIDAK TERTUTUP MODAL APAPUN) */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-[100000] animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 text-center">
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">{alertModal.title}</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">{alertModal.message}</p>
            <button
              type="button"
              onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })}
              className="w-full py-2 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-70">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl border border-slate-200 text-center">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Konfirmasi Selesai Bertugas</h3>
            <p className="text-xs text-slate-600 mb-6">
              Apakah Anda yakin ingin keluar dari sesi operasional <b>{currentUser.name || currentUser.id}</b>?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                  localStorage.removeItem("wms_user_session");
                  sessionStorage.removeItem("wms_visited_session");
                  router.push("/login");
                }}
                className="flex-1 py-2 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}