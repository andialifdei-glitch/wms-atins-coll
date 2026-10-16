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
  setDoc,
  deleteDoc,
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
import ReceivingModal from "@/components/modals/ReceivingModal";
import NotificationBell from "@/components/notifications/NotificationBell";
import { createOperationalNotification } from "@/lib/notifications";

type MainTab = "dashboard" | "sales" | "inventory" | "purchase" | "reports" | "settings" | "human";

interface RegionItem {
  id: string;
  name: string;
}

// Generator Binary PDF Murni (Standar PDF-1.4 Valid) agar tidak korup di PDF reader
function generateValidPdfBlob(title: string, headers: string[], rows: any[][]): Blob {
  const sanitize = (text: string) => String(text || "-").replace(/[\\()]/g, " ");

  let contentStream = "BT\n/F1 14 Tf\n40 790 Td\n(" + sanitize(title) + ") Tj\nET\n";
  contentStream += "BT\n/F1 8 Tf\n40 775 Td\n(Dicetak: " + sanitize(new Date().toLocaleString("id-ID")) + ") Tj\nET\n";

  let y = 750;
  // Header Table
  contentStream += "BT\n/F1 9 Tf\n";
  let x = 40;
  headers.forEach((h) => {
    contentStream += `${x} ${y} Td\n(${sanitize(h)}) Tj\n${-x} ${-y} Td\n`;
    x += 100;
  });
  contentStream += "ET\n";

  // Rows
  y -= 15;
  contentStream += "BT\n/F1 8 Tf\n";
  rows.slice(0, 45).forEach((row) => {
    let rx = 40;
    row.forEach((cell) => {
      contentStream += `${rx} ${y} Td\n(${sanitize(String(cell))}) Tj\n${-rx} ${-y} Td\n`;
      rx += 100;
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

export default function DashboardClient() {
  const router = useRouter();

  // Tabs
  const [currentTab, setCurrentTab] = useState<MainTab>("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [salesSubTab, setSalesSubTab] = useState<"so" | "do">("so");
  const [invSubTab, setInvSubTab] = useState<string>("products");
  const [poSubTab, setPoSubTab] = useState<string>("po_list");
  const [reportSubTab, setReportSubTab] = useState<"so" | "do" | "po" | "receiving" | "opname" | "stock" | "sales" | "customer">("so");
  const [humanSubTab, setHumanSubTab] = useState<"staff" | "suppliers" | "customers">("staff");

  // Master Data
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

  // Search & Filter
  const [soSearchQuery, setSoSearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [soStatusFilter, setSoStatusFilter] = useState<string>("ALL");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [salesReportType, setSalesReportType] = useState<"day" | "item" | "summary">("summary");

  // User & Store Settings
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string; username?: string }>({
    id: "admin",
    role: "Root Admin",
    name: "Root Administrator",
    username: "admin",
  });

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

  // Modal & Alerts
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const [isSessionTimeoutOpen, setIsSessionTimeoutOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // SO Detail & Action
  const [selectedSoDetail, setSelectedSoDetail] = useState<any | null>(null);
  const [isSoDetailModalOpen, setIsSoDetailModalOpen] = useState(false);
  const [soCancelTarget, setSoCancelTarget] = useState<any | null>(null);
  const [soCancelReason, setSoCancelReason] = useState("");
  const [isSoCancelConfirmOpen, setIsSoCancelConfirmOpen] = useState(false);

  // DO Bluetooth & Actions
  const [doCancelTarget, setDoCancelTarget] = useState<any | null>(null);
  const [doCancelReason, setDoCancelReason] = useState("");
  const [isDoCancelConfirmOpen, setIsDoCancelConfirmOpen] = useState(false);
  const [btPrintDevice, setBtPrintDevice] = useState<any | null>(null);
  const [btStatus, setBtStatus] = useState<string>("Belum Terkoneksi");

  // SOP Review & Post
  const [reviewSopTarget, setReviewSopTarget] = useState<any | null>(null);
  const [isSopReviewModalOpen, setIsSopReviewModalOpen] = useState(false);
  const [reviewItemsData, setReviewItemsData] = useState<any[]>([]);
  const [sopCancelTarget, setSopCancelTarget] = useState<any | null>(null);
  const [sopCancelReason, setSopCancelReason] = useState("");
  const [sopCountdown, setSopCountdown] = useState(10);
  const [isSopCancelConfirmOpen, setIsSopCancelConfirmOpen] = useState(false);

  // PO & Customer State
  const [poCancelTarget, setPoCancelTarget] = useState<any | null>(null);
  const [poCancelReason, setPoCancelReason] = useState("");
  const [isPoCancelConfirmOpen, setIsPoCancelConfirmOpen] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<"create" | "edit">("create");
  const [customerForm, setCustomerForm] = useState({
    customerId: "",
    customerName: "",
    phone: "",
    email: "",
    address: "",
    displayAddress: "",
  });
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Staff CRUD State
  const [staffModalMode, setStaffModalMode] = useState<"create" | "edit">("create");
  const [staffForm, setStaffForm] = useState({
    staffId: "",
    fullName: "",
    userId: "",
    password: "",
  });
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // External Component Modals
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
  });
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [isInitSopModalOpen, setIsInitSopModalOpen] = useState(false);
  const [isSoModalOpen, setIsSoModalOpen] = useState(false);
  const [editingSoId, setEditingSoId] = useState<string | null>(null);
  const [soModalInitCustomer, setSoModalInitCustomer] = useState<any | null>(null);
  const [soModalInitItems, setSoModalInitItems] = useState<any[]>([]);
  const [soModalInitRates, setSoModalInitRates] = useState<any[]>([]);
  const [soModalInitCost, setSoModalInitCost] = useState<number>(0);
  const [soModalInitCourier, setSoModalInitCourier] = useState<string>("");
  const [soModalInitService, setSoModalInitService] = useState<string>("");
  const [isEditExpeditionModalOpen, setIsEditExpeditionModalOpen] = useState(false);
  const [targetProcessingSo, setTargetProcessingSo] = useState<any | null>(null);
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [selectedPoForReceiving, setSelectedPoForReceiving] = useState<any | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [selectedProductLedger, setSelectedProductLedger] = useState<any | null>(null);

  // Wilayah & RajaOngkir API
  const [provinces, setProvinces] = useState<RegionItem[]>([]);
  const [regencies, setRegencies] = useState<RegionItem[]>([]);
  const [districts, setDistricts] = useState<RegionItem[]>([]);
  const [villages, setVillages] = useState<RegionItem[]>([]);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [inputApiKey, setInputApiKey] = useState("");
  const [apiKeyTestedSuccess, setApiKeyTestedSuccess] = useState(false);
  const [testedToken, setTestedToken] = useState<string | null>(null);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isApiSuccessModalOpen, setIsApiSuccessModalOpen] = useState(false);

  // Force Logout saat buka web pertama kali
  useEffect(() => {
    const hasVisited = sessionStorage.getItem("wms_visited_session");
    if (!hasVisited) {
      sessionStorage.setItem("wms_visited_session", "true");
      document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      router.push("/login");
    }
  }, [router]);

  // Session Timeout (5 Menit)
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
    router.push("/login");
  };

  // Auth User Session Init
  useEffect(() => {
    try {
      const match = document.cookie.split("; ").find((row) => row.startsWith("admin_session="));
      if (match) {
        const parsed = JSON.parse(decodeURIComponent(match.split("=")[1]));
        const uName = parsed.username || parsed.userId || parsed.id || "admin";
        setCurrentUser({
          id: uName,
          role: uName.toLowerCase() === "admin" ? "Root Admin" : (parsed.role || "Admin Gudang"),
          name: parsed.name || parsed.fullName || (uName.toLowerCase() === "admin" ? "Root Administrator" : uName),
          username: uName,
        });
      }
    } catch {}
  }, []);

  const isRootAdmin = useMemo(() => {
    const roleClean = String(currentUser.role || "").trim().toLowerCase();
    const userClean = String(currentUser.username || currentUser.id || "").trim().toLowerCase();
    return userClean === "admin" || roleClean.includes("root");
  }, [currentUser]);

  const isStaff = useMemo(() => {
    const roleClean = String(currentUser.role || "").trim().toLowerCase();
    return roleClean.includes("staff");
  }, [currentUser]);

  const showAlert = (message: string, title = "Informasi") => {
    setAlertModal({ isOpen: true, title, message });
  };

  // Load Firestore Data
  async function loadAllData() {
    setLoading(true);
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

          const foundSettings = (d.settings || []).find((s: any) => s.id === "store_info");
          if (foundSettings) {
            setStoreSettings((prev: any) => ({ ...prev, ...foundSettings }));
            if (foundSettings.rajaOngkirApiKey) {
              setInputApiKey(foundSettings.rajaOngkirApiKey);
            }
          }
          setLoading(false);
          return;
        }
      }

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
    } catch (err: any) {
      console.error("Gagal load Firestore:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAllData(); }, []);

  // Filtered
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
      return sku.includes(q) || name.includes(q) || fam.includes(q);
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

  // Load Wilayah Indonesia
  useEffect(() => {
    if (currentTab === "settings" && provinces.length === 0) {
      setLoadingRegion(true);
      fetch("/api/regions")
        .then((res) => res.json())
        .then((data) => { if (Array.isArray(data)) setProvinces(data); })
        .catch((err) => console.error("Gagal load provinsi:", err))
        .finally(() => setLoadingRegion(false));
    }
  }, [currentTab, provinces.length]);

  async function handleProvinceChange(pCode: string) {
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
  }

  async function handleRegencyChange(rCode: string) {
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
  }

  async function handleDistrictChange(dCode: string) {
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
  }

  function handleVillageChange(vCode: string) {
    const vil = villages.find((v) => v.id === vCode);
    setStoreSettings((prev) => ({
      ...prev,
      villageCode: vCode,
      villageName: vil?.name || "",
    }));
  }

  async function handleSaveStoreAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!storeSettings.provinceName || !storeSettings.regencyName || !storeSettings.districtName || !storeSettings.villageName) {
      return showAlert("Harap lengkapi pemilihan Provinsi, Kabupaten/Kota, Kecamatan, dan Desa/Kelurahan!", "Peringatan");
    }
    const fullAddr = `${storeSettings.detailAddress ? storeSettings.detailAddress.trim() + ", " : ""}Desa/Kel. ${storeSettings.villageName}, Kec. ${storeSettings.districtName}, ${storeSettings.regencyName}, ${storeSettings.provinceName}${storeSettings.postalCode ? " " + storeSettings.postalCode : ""}`;

    try {
      setLoading(true);
      await setDoc(doc(db, "settings", "store_info"), {
        ...storeSettings,
        storeAddress: fullAddr,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
      }, { merge: true });
      setStoreSettings((prev) => ({ ...prev, storeAddress: fullAddr }));
      showAlert("Alamat resmi toko berhasil disimpan!", "Sukses");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan alamat toko");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestApiKey() {
    if (!inputApiKey.trim()) return showAlert("Masukkan API Key terlebih dahulu!", "Peringatan");
    setIsTestingApiKey(true);
    setApiKeyTestedSuccess(false);
    setTestedToken(null);
    try {
      const res = await fetch("/api/shipping/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TEST_CONNECTION", apiKey: inputApiKey.trim(), userRole: currentUser.role }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestedToken(data.token);
        setIsApiSuccessModalOpen(true);
      } else {
        showAlert(data.message || "API Key tidak bekerja. Periksa kembali kunci Anda.", "Gagal Terhubung");
      }
    } catch (e: any) {
      showAlert("Terjadi kendala jaringan saat menghubungi server pengujian.", "Error");
    } finally {
      setIsTestingApiKey(false);
    }
  }

  async function handleConfirmAndSaveApiKey() {
    if (!apiKeyTestedSuccess || !testedToken) return showAlert("API Key harus diuji terlebih dahulu!", "Peringatan");
    setIsSavingApiKey(true);
    try {
      const res = await fetch("/api/shipping/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM_AND_SAVE", apiKey: inputApiKey.trim(), userRole: currentUser.role, token: testedToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert("Perubahan API Key RajaOngkir berhasil disimpan!", "Sukses");
        setStoreSettings((prev) => ({ ...prev, rajaOngkirApiKey: inputApiKey.trim() }));
        setApiKeyTestedSuccess(false);
        setTestedToken(null);
        loadAllData();
      } else {
        showAlert(data.message || "Gagal menyimpan API Key.", "Error");
      }
    } catch (err: any) {
      showAlert(err.message || "Gagal menghubungi server", "Error");
    } finally {
      setIsSavingApiKey(false);
    }
  }

  // Web Bluetooth Direct ESC/POS Label Printing
  async function handleScanBluetoothPrinter() {
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      return showAlert("Browser tidak mendukung Web Bluetooth API. Gunakan browser Google Chrome di PC/Laptop dengan Bluetooth aktif.", "Bluetooth Error");
    }
    try {
      setBtStatus("Mencari Printer Bluetooth...");
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb", "49535343-fe7d-4ae5-8fa9-9fafd205e455", "e7810a71-73ae-499d-8c15-faa9aef0c3f2"],
      });
      setBtPrintDevice(device);
      setBtStatus(`Terhubung: ${device.name || "Bluetooth Printer"}`);
      setStoreSettings((prev) => ({ ...prev, btPrinterDeviceName: device.name || "Bluetooth Printer" }));
      showAlert(`Printer Bluetooth [${device.name || "Unknown Printer"}] berhasil terhubung!`, "Sukses");
    } catch (e: any) {
      setBtStatus("Koneksi Bluetooth Dibatalkan / Gagal");
    }
  }

  async function handlePrintDoLabel(d: any) {
    const today = new Date().toLocaleDateString("id-ID");
    const encoder = new TextEncoder();

    const INIT = [0x1b, 0x40];
    const ALIGN_CENTER = [0x1b, 0x61, 0x01];
    const ALIGN_LEFT = [0x1b, 0x61, 0x00];
    const BOLD_ON = [0x1b, 0x45, 0x01];
    const BOLD_OFF = [0x1b, 0x45, 0x00];
    const DOUBLE_SIZE = [0x1d, 0x21, 0x11];
    const NORMAL_SIZE = [0x1d, 0x21, 0x00];
    const FEED_3 = [0x1b, 0x64, 0x03];

    let commands: number[] = [];
    commands.push(...INIT);
    commands.push(...ALIGN_CENTER);
    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("Atin's Collection\n"));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode("Banjaran, Kab. Bandung\n\n"));
    commands.push(...DOUBLE_SIZE);
    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("DELIVERI ORDER\n\n"));
    commands.push(...NORMAL_SIZE);
    commands.push(...BOLD_OFF);

    commands.push(...ALIGN_LEFT);
    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("NOMOR DELIVERY ORDER\n"));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${d.doId}\n\n`));

    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("PENGIRIM\n"));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode("Atin's Collection\n"));
    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("NO HANDPHONE\n"));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${storeSettings.storePhone || "0899-7884-435"}\n\n`));

    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("PENERIMA\n"));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${d.recipientName}\n`));
    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("NO HANDPHONE\n"));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${d.recipientPhone || "-"}\n`));
    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("ALAMAT\n"));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${d.recipientAddress}\n\n`));

    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("Reff SO : "));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${d.soId}\n`));

    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("TANGGAL CETAK : "));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${today}\n`));

    commands.push(...BOLD_ON);
    commands.push(...encoder.encode("OLEH : "));
    commands.push(...BOLD_OFF);
    commands.push(...encoder.encode(`${currentUser.name}\n`));

    commands.push(...FEED_3);

    if (btPrintDevice && btPrintDevice.gatt) {
      try {
        setLoading(true);
        const server = await btPrintDevice.gatt.connect();
        const services = await server.getPrimaryServices();
        let writeChar: any = null;
        for (const s of services) {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
          if (writeChar) break;
        }

        if (writeChar) {
          const data = new Uint8Array(commands);
          await writeChar.writeValue(data);
          showAlert(`Label DO [${d.doId}] berhasil dicetak langsung ke printer Bluetooth!`, "Sukses");
          return;
        }
      } catch (err: any) {
        console.warn("Direct Bluetooth print error:", err);
      } finally {
        setLoading(false);
      }
    }
    showAlert("Printer Bluetooth belum terhubung! Silakan buka menu Pengaturan -> Hardware Printer Thermal Bluetooth, lalu tekan 'Cari Printer Bluetooth' untuk menghubungkannya.", "Printer Belum Siap");
  }

  // SO Handlers
  async function executeCancelSo() {
    if (!soCancelTarget) return;
    if (!soCancelReason.trim()) return showAlert("Alasan pembatalan SO wajib diisi!", "Peringatan");
    try {
      setLoading(true);
      const targetId = soCancelTarget.soId || soCancelTarget.id;
      await updateDoc(doc(db, "sales_orders", targetId), {
        status: "CANCELLED",
        cancelReason: soCancelReason.trim(),
        cancelledAt: serverTimestamp(),
        cancelledBy: currentUser.name,
        updatedAt: serverTimestamp(),
      });
      setIsSoCancelConfirmOpen(false);
      setIsSoDetailModalOpen(false);
      setSoCancelTarget(null);
      setSoCancelReason("");
      showAlert(`Sales Order [${targetId}] berhasil dibatalkan.`, "Sukses");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal membatalkan Sales Order");
    } finally {
      setLoading(false);
    }
  }

  async function executeMarkProcessing(so: any) {
    try {
      setLoading(true);
      await updateDoc(doc(db, "sales_orders", so.soId || so.id), {
        status: "PROCESSING",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
      });
      setIsSoDetailModalOpen(false);
      showAlert(`Status SO [${so.soId}] diubah ke PROCESSING!`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal mengubah status SO");
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
        updatedBy: currentUser.name,
      });
      setIsSoDetailModalOpen(false);
      showAlert(`SO [${so.soId}] berstatus READY TO DELIVER! Siap diterbitkan DO.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal mengubah status SO");
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

          tx.update(pRef, { stock: newStock, updatedAt: serverTimestamp(), updatedBy: currentUser.name });

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
            user: currentUser.name,
            timestamp: serverTimestamp(),
          });
        }

        tx.update(soRef, { status: "DELIVERY ORDER", updatedAt: serverTimestamp(), updatedBy: currentUser.name });

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
          createdBy: currentUser.name,
          createdAt: serverTimestamp(),
          status: "DELIVERED",
        });
        return generatedDoId;
      });

      setIsSoDetailModalOpen(false);
      showAlert(`Delivery Order [${doId}] berhasil diterbitkan dan stok fisik gudang terpotong!`, "Sukses");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal memproses Delivery Order.");
    } finally {
      setLoading(false);
    }
  }

  // DO Cancellation
  async function executeCancelDo() {
    if (!isRootAdmin) return showAlert("Hanya ROOT ADMIN yang berhak membatalkan Delivery Order (DO)!", "Akses Ditolak");
    if (!doCancelTarget) return;
    if (!doCancelReason.trim()) return showAlert("Alasan pembatalan DO wajib diisi!", "Peringatan");

    try {
      setLoading(true);
      const today = new Date();
      const displayDate = today.toISOString().split("T")[0];
      const doTargetId = doCancelTarget.doId || doCancelTarget.id;

      await runTransaction(db, async (tx) => {
        const doRef = doc(db, "delivery_orders", doTargetId);
        const doSnap = await tx.get(doRef);
        if (!doSnap.exists()) throw new Error("Dokumen DO tidak ditemukan!");

        for (const it of doCancelTarget.items || []) {
          const pRef = doc(db, "products", it.sku);
          const pSnap = await tx.get(pRef);
          if (pSnap.exists()) {
            const curStock = Number(pSnap.data().stock || 0);
            const returnedQty = Number(it.qty || it.quantity || 1);
            const restoredStock = curStock + returnedQty;

            tx.update(pRef, { stock: restoredStock, updatedAt: serverTimestamp(), updatedBy: currentUser.name });

            const mvRef = doc(collection(db, "stock_movements"));
            tx.set(mvRef, {
              movementId: mvRef.id,
              date: displayDate,
              itemCode: it.sku,
              itemNameSnapshot: it.itemName,
              type: "ADJUSTMENT",
              referenceId: `CANCEL-${doTargetId}`,
              qtyIn: returnedQty,
              qtyOut: 0,
              previousStock: curStock,
              newStock: restoredStock,
              reason: `Pembatalan DO ${doTargetId}: ${doCancelReason.trim()}`,
              user: currentUser.name,
              timestamp: serverTimestamp(),
            });
          }
        }

        tx.update(doRef, {
          status: "CANCELLED",
          cancelReason: doCancelReason.trim(),
          cancelledBy: currentUser.name,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (doCancelTarget.soId) {
          const soRef = doc(db, "sales_orders", doCancelTarget.soId);
          tx.update(soRef, {
            status: "READY TO DELIVER",
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.name,
          });
        }
      });

      setIsDoCancelConfirmOpen(false);
      setDoCancelTarget(null);
      setDoCancelReason("");
      showAlert(`DO [${doTargetId}] berhasil dibatalkan. Stok barang telah dipulihkan!`, "Sukses");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal membatalkan Delivery Order");
    } finally {
      setLoading(false);
    }
  }

  // Stock Opname Review Flow
  function handleOpenSopReview(sop: any) {
    setReviewSopTarget(sop);
    setReviewItemsData(JSON.parse(JSON.stringify(sop.items || [])));
    setIsSopReviewModalOpen(true);
  }

  function handleExportSopReviewExcel() {
    if (!reviewSopTarget) return;
    const dateStr = reviewSopTarget.opnameDate || new Date().toISOString().split("T")[0];
    const headers = ["date", "itemcode", "itemname", "qty asal", "qty hitung", "qty value", "qty variance", "counted by"];
    const rows = reviewItemsData.map((it: any) => {
      const orig = Number(it.systemQtySnapshot || 0);
      const phys = it.physicalQty != null ? Number(it.physicalQty) : orig;
      const variance = phys - orig;
      return [
        dateStr,
        it.skuCode || it.skuId,
        it.itemName,
        orig,
        phys,
        phys,
        variance,
        it.countedBy || currentUser.name,
      ];
    });
    downloadExcel(reviewSopTarget.documentNo || reviewSopTarget.sopId, "SOP_Review", headers, rows);
  }

  async function handleConfirmPostStockOpname() {
    if (!reviewSopTarget) return;
    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];

      const srvwId = `SRVW-${dateStr}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const postId = `POST-${dateStr}-${String(Math.floor(1000 + Math.random() * 9000))}`;

      await runTransaction(db, async (tx) => {
        const sopRef = doc(db, "stock_opnames", reviewSopTarget.documentNo || reviewSopTarget.sopId || reviewSopTarget.id);

        for (const it of reviewItemsData) {
          const pRef = doc(db, "products", it.skuCode || it.skuId);
          const pSnap = await tx.get(pRef);
          if (pSnap.exists()) {
            const currentStock = Number(pSnap.data().stock || 0);
            const physical = Number(it.physicalQty ?? currentStock);
            const diff = physical - currentStock;

            tx.update(pRef, { stock: physical, updatedAt: serverTimestamp(), updatedBy: currentUser.name });

            if (diff !== 0) {
              const mvRef = doc(collection(db, "stock_movements"));
              tx.set(mvRef, {
                movementId: mvRef.id,
                date: displayDate,
                itemCode: it.skuCode || it.skuId,
                itemNameSnapshot: it.itemName,
                type: "ADJUSTMENT",
                referenceId: postId,
                qtyIn: diff > 0 ? diff : 0,
                qtyOut: diff < 0 ? Math.abs(diff) : 0,
                previousStock: currentStock,
                newStock: physical,
                reason: `Stock Opname Posting ${postId} (Review: ${srvwId})`,
                user: currentUser.name,
                timestamp: serverTimestamp(),
              });
            }
          }
        }

        tx.update(sopRef, {
          status: "POSTED",
          items: reviewItemsData,
          reviewDocumentNo: srvwId,
          postingId: postId,
          postedBy: currentUser.name,
          postedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setIsSopReviewModalOpen(false);
      setReviewSopTarget(null);
      showAlert(`Stock Opname berhasil diposting! Review: [${srvwId}], Posting: [${postId}].`, "Sukses");
      loadAllData();
    } catch (e: any) {
      showAlert(e.message || "Gagal memposting Stock Opname");
    } finally {
      setLoading(false);
    }
  }

  // Staff CRUD Handlers (Auto-increment ST-xx)
  async function handleOpenAddStaff() {
    if (!isRootAdmin) return showAlert("Hanya Root Admin yang berhak menambahkan staff!", "Akses Ditolak");
    try {
      setLoading(true);
      const cSnap = await runTransaction(db, async (tx) => {
        const counterRef = doc(db, "counters", "staff");
        const snap = await tx.get(counterRef);
        const curr = snap.exists() ? (snap.data().currentNumber || 0) : 0;
        return curr + 1;
      });
      const generatedStaffId = `ST-${String(cSnap).padStart(2, "0")}`;
      setStaffForm({ staffId: generatedStaffId, fullName: "", userId: "", password: "" });
      setStaffModalMode("create");
      setIsStaffModalOpen(true);
    } catch (err: any) {
      const fallbackId = `ST-${String(usersList.length + 1).padStart(2, "0")}`;
      setStaffForm({ staffId: fallbackId, fullName: "", userId: "", password: "" });
      setStaffModalMode("create");
      setIsStaffModalOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!isRootAdmin) return showAlert("Hanya Root Admin yang berhak mengubah staff!", "Akses Ditolak");
    if (!staffForm.fullName.trim() || !staffForm.userId.trim() || !staffForm.password.trim()) {
      return showAlert("Seluruh kolom wajib diisi!", "Peringatan");
    }

    try {
      setLoading(true);
      const cleanUserId = staffForm.userId.trim().toLowerCase();

      if (staffModalMode === "create") {
        const counterRef = doc(db, "counters", "staff");
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const curr = snap.exists() ? (snap.data().currentNumber || 0) : 0;
          tx.set(counterRef, { currentNumber: curr + 1, updatedAt: serverTimestamp() }, { merge: true });

          const userDocRef = doc(db, "users", cleanUserId);
          tx.set(userDocRef, {
            staffId: staffForm.staffId,
            userId: cleanUserId,
            username: cleanUserId,
            fullName: staffForm.fullName.trim(),
            name: staffForm.fullName.trim(),
            password: staffForm.password,
            role: "Staff Gudang",
            active: true,
            createdAt: serverTimestamp(),
            createdBy: currentUser.name,
          });
        });
        showAlert(`Staff baru [${staffForm.staffId} - ${cleanUserId}] berhasil ditambahkan!`, "Sukses");
      } else {
        await updateDoc(doc(db, "users", cleanUserId), {
          fullName: staffForm.fullName.trim(),
          name: staffForm.fullName.trim(),
          password: staffForm.password,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name,
        });
        showAlert(`Data staff [${cleanUserId}] berhasil diperbarui!`, "Sukses");
      }

      setIsStaffModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan data staff");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStaff(u: any) {
    if (!isRootAdmin) return showAlert("Hanya Root Admin yang berhak menghapus staff!", "Akses Ditolak");
    if (u.userId === "admin" || String(u.role).toLowerCase().includes("root")) {
      return showAlert("Root Administrator tidak dapat dihapus!", "Akses Ditolak");
    }
    if (!confirm(`Hapus/nonaktifkan akun staff ${u.fullName} (${u.userId})?`)) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, "users", u.id || u.userId));
      showAlert(`Akun staff [${u.userId}] berhasil dihapus.`, "Sukses");
      loadAllData();
    } catch (e: any) {
      showAlert(e.message || "Gagal menghapus akun staff");
    } finally {
      setLoading(false);
    }
  }

  // Supplier CRUD Handlers
  async function handleOpenAddSupplier() {
    if (!isRootAdmin) return showAlert("Hanya Root Admin yang berhak mengelola supplier!", "Akses Ditolak");
    setEditingSupplier(null);
    setIsSupplierModalOpen(true);
  }

  async function handleSaveSupplier(formData: any) {
    if (!isRootAdmin) return showAlert("Hanya Root Admin yang berhak mengelola supplier!", "Akses Ditolak");
    try {
      setLoading(true);
      if (editingSupplier && (editingSupplier.supplierId || editingSupplier.id)) {
        const suppKey = editingSupplier.supplierId || editingSupplier.id;
        await updateDoc(doc(db, "suppliers", suppKey), {
          supplierName: formData.supplierName.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name,
        });
        showAlert(`Supplier [${suppKey}] berhasil diperbarui!`, "Sukses");
      } else {
        const counterRef = doc(db, "counters", "supplier");
        const newSuppId = await runTransaction(db, async (tx) => {
          const cSnap = await tx.get(counterRef);
          const curr = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
          const next = curr + 1;
          const genId = `SUPP-${String(next).padStart(4, "0")}`;
          tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() }, { merge: true });
          tx.set(doc(db, "suppliers", genId), {
            supplierId: genId,
            documentNo: genId,
            supplierName: formData.supplierName.trim(),
            phone: formData.phone.trim(),
            address: formData.address.trim(),
            active: true,
            createdAt: serverTimestamp(),
            createdBy: currentUser.name,
          });
          return genId;
        });
        showAlert(`Supplier baru [${newSuppId}] berhasil didaftarkan!`, "Sukses");
      }
      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      loadAllData();
    } catch (e: any) {
      showAlert(e.message || "Gagal menyimpan supplier");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSupplier(s: any) {
    if (!isRootAdmin) return showAlert("Hanya Root Admin yang berhak menghapus supplier!", "Akses Ditolak");
    if (!confirm(`Hapus data supplier ${s.supplierName} (${s.supplierId || s.id})?`)) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, "suppliers", s.id || s.supplierId));
      showAlert(`Supplier [${s.supplierName}] berhasil dihapus.`);
      loadAllData();
    } catch (e: any) {
      showAlert(e.message || "Gagal menghapus supplier");
    } finally {
      setLoading(false);
    }
  }

  // Customer CRUD Handlers (CUST-XXXX)
  async function handleSaveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.customerName.trim()) return showAlert("Nama Customer wajib diisi!");
    try {
      setLoading(true);
      if (customerModalMode === "create") {
        const counterRef = doc(db, "counters", "customer");
        const nextCustId = await runTransaction(db, async (tx) => {
          const cSnap = await tx.get(counterRef);
          const curr = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
          const next = curr + 1;
          const genId = `CUST-${String(next).padStart(4, "0")}`;
          tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() }, { merge: true });
          tx.set(doc(db, "customers", genId), {
            customerId: genId,
            customerName: customerForm.customerName.trim(),
            phone: customerForm.phone.trim(),
            email: customerForm.email.trim(),
            address: customerForm.address.trim(),
            displayAddress: customerForm.displayAddress.trim() || customerForm.address.trim(),
            createdAt: serverTimestamp(),
            createdBy: currentUser.name,
          });
          return genId;
        });
        showAlert(`Customer baru [${nextCustId}] berhasil ditambahkan!`, "Sukses");
      } else {
        await updateDoc(doc(db, "customers", customerForm.customerId), {
          customerName: customerForm.customerName.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          address: customerForm.address.trim(),
          displayAddress: customerForm.displayAddress.trim() || customerForm.address.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name,
        });
        showAlert(`Data customer [${customerForm.customerId}] berhasil diperbarui!`, "Sukses");
      }
      setIsCustomerModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan customer");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCustomer(cust: any) {
    if (!confirm(`Hapus customer ${cust.customerName} (${cust.customerId || cust.id})?`)) return;
    try {
      setLoading(true);
      await deleteDoc(doc(db, "customers", cust.id || cust.customerId));
      showAlert(`Customer berhasil dihapus.`);
      loadAllData();
    } catch (e: any) {
      showAlert(e.message || "Gagal menghapus customer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#FFF5F6] font-sans text-rose-950">
      {/* Session Timeout Modal */}
      {isSessionTimeoutOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-200 text-center">
            <div className="text-3xl mb-2">⏱️</div>
            <h3 className="text-base font-bold text-rose-950 mb-2">Sesi Berakhir</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">Sesi berakhir, otomatis keluar.</p>
            <button
              type="button"
              onClick={handleSessionTimeoutLogout}
              className="w-full py-2.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-xl shadow"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[#6E354F] bg-[#4A2033] text-rose-100 shadow-2xl transition-transform duration-200 md:relative md:inset-auto md:z-auto md:translate-x-0 md:shrink-0 ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="p-5 border-b border-[#6E354F]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧕</span>
            <h1 className="text-base font-bold text-white tracking-wide">WMS Atin&apos;s Coll</h1>
          </div>
          <p className="text-[11px] text-rose-300 mt-0.5">Warehouse Management System</p>
          <div className="mt-3 px-3 py-1.5 bg-[#5C2B42] rounded-lg text-xs flex justify-between items-center text-rose-200">
            <span>Login: <b className="text-white">{currentUser.name}</b></span>
            {isRootAdmin ? (
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold uppercase">Root</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[9px] font-bold uppercase">{currentUser.role}</span>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[
            { key: "dashboard", icon: "📊", label: "Dashboard" },
            { key: "sales", icon: "🛒", label: "Sales & Delivery Order" },
            { key: "inventory", icon: "📦", label: "Inventory & Persediaan" },
            { key: "purchase", icon: "📥", label: "Purchase Order & Receiving" },
            { key: "reports", icon: "📑", label: "Laporan (Reports)" },
            { key: "settings", icon: "⚙️", label: "Pengaturan & Toko" },
            ...(isRootAdmin ? [{ key: "human", icon: "👥", label: "Human" }] : []),
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setCurrentTab(item.key as MainTab);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                currentTab === item.key ? "bg-[#BE185D] text-white shadow" : "text-rose-200 hover:bg-[#5C2B42]"
              }`}
            >
              <span>{item.icon}</span> <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#6E354F]">
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="w-full py-2 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg shadow"
          >
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-rose-100 bg-white px-4 py-3 shadow-xs sm:px-6 md:px-8 md:py-4">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="shrink-0 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-900 md:hidden"
            aria-label="Buka menu navigasi"
          >
            ☰
          </button>
          <div>
            <h2 className="text-lg font-bold text-rose-950 uppercase">
              {currentTab === "dashboard" && "Dashboard Operasional"}
              {currentTab === "sales" && "Manajemen Sales Order (SO) & Delivery Order (DO)"}
              {currentTab === "inventory" && "Katalog Persediaan & Stock Card Ledger"}
              {currentTab === "purchase" && "Purchasing Order (PO) & Penerimaan Barang"}
              {currentTab === "reports" && "Pusat Laporan Historis"}
              {currentTab === "settings" && "Konfigurasi Toko & Hardware Printer"}
              {currentTab === "human" && "Manajemen Human (Staff, Supplier & Customer)"}
            </h2>
            <p className="text-xs text-rose-500">Database Realtime Firestore Sinkron</p>
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
              className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-medium"
            >
              🔄 Refresh Data
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-auto p-6">
          {/* TAB 1: DASHBOARD */}
          {currentTab === "dashboard" && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">Total SKU Master</div>
                <div className="text-2xl font-bold text-rose-950 mt-1">{products.length} SKU</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">Total Saldo Fisik</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {products.reduce((acc, p) => acc + Number(p.stock || 0), 0)} pcs
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">SO Processing</div>
                <div className="text-2xl font-bold text-purple-600 mt-1">
                  {salesOrders.filter((s) => s.status === "PROCESSING").length} SO
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs">
                <div className="text-xs text-slate-500 font-medium">SO Ready to Deliver</div>
                <div className="text-2xl font-bold text-amber-600 mt-1">
                  {salesOrders.filter((s) => s.status === "READY TO DELIVER").length} SO
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SALES ORDER & DELIVERY ORDER */}
          {currentTab === "sales" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-rose-200 pb-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSalesSubTab("so")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      salesSubTab === "so" ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                    }`}
                  >
                    Daftar Semua Sales Order ({salesOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesSubTab("do")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      salesSubTab === "do" ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                    }`}
                  >
                    Delivery Orders ({deliveryOrders.length})
                  </button>
                </div>

                {salesSubTab === "so" && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-rose-950">Filter Status:</span>
                    <select
                      value={soStatusFilter}
                      onChange={(e) => setSoStatusFilter(e.target.value)}
                      className="p-1.5 border border-rose-200 rounded-lg bg-white font-bold text-[#BE185D] outline-none"
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

              {/* 2.1 SALES ORDERS */}
              {salesSubTab === "so" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <span className="text-xs font-bold text-rose-950">
                      Menampilkan {displayedSalesOrders.length} Sales Order
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Cari SO (Nama Pemesan / Alamat)..."
                        value={soSearchQuery}
                        onChange={(e) => setSoSearchQuery(e.target.value)}
                        className="p-1.5 px-3 border border-rose-200 rounded-lg text-xs outline-none w-full sm:w-64 bg-rose-50/40 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSoId(null);
                          setSoModalInitCustomer(null);
                          setSoModalInitItems([]);
                          setSoModalInitRates([]);
                          setSoModalInitCost(0);
                          setSoModalInitCourier("");
                          setSoModalInitService("");
                          setIsSoModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow whitespace-nowrap"
                      >
                        + Buat Sales Order (SO) Baru
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">No SO</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Customer & Alamat</th>
                          <th className="p-2.5">Total Kuantitas</th>
                          <th className="p-2.5">Ekspedisi & Ongkir</th>
                          <th className="p-2.5">Total Bayar</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {displayedSalesOrders.map((so) => (
                          <tr key={so.id}>
                            <td className="p-2.5 font-mono font-bold">{so.soId}</td>
                            <td className="p-2.5">{so.date}</td>
                            <td className="p-2.5">
                              <div className="font-bold">{so.customerName} ({so.phone})</div>
                              <div className="text-[10px] text-slate-500 max-w-xs truncate">{so.address}</div>
                            </td>
                            <td className="p-2.5">
                              <div className="text-slate-700 font-semibold">
                                {(so.items || []).reduce((acc: number, it: any) => acc + (Number(it.qty || it.quantity) || 0), 0)} pcs total ({(so.items || []).length} SKU)
                              </div>
                            </td>
                            <td className="p-2.5">
                              <div>{so.shippingServiceName || so.expedition || "-"}</div>
                              <div className="text-[10px] text-slate-500">{formatRupiah(Number(so.shippingCost || 0))}</div>
                            </td>
                            <td className="p-2.5 font-bold text-emerald-600">{formatRupiah(Number(so.total || 0))}</td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                so.status === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                                so.status === "PROCESSING" ? "bg-purple-100 text-purple-800" :
                                so.status === "READY TO DELIVER" ? "bg-amber-100 text-amber-800" :
                                so.status === "DELIVERY ORDER" ? "bg-emerald-100 text-emerald-800" :
                                "bg-red-100 text-red-800"
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
                                className="px-3 py-1 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded-lg text-xs font-bold shadow-xs"
                              >
                                🔍 Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2.2 DELIVERY ORDERS */}
              {salesSubTab === "do" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-rose-950 uppercase">Daftar Delivery Order (Stok Telah Dipotong)</span>
                    <span className="text-xs text-slate-500">Total: <b>{deliveryOrders.length}</b> DO</span>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">No DO</th>
                          <th className="p-2.5">Ref SO</th>
                          <th className="p-2.5">Penerima</th>
                          <th className="p-2.5">Ekspedisi</th>
                          <th className="p-2.5">Total Pcs</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {deliveryOrders.map((d) => (
                          <tr key={d.id}>
                            <td className="p-2.5 font-mono font-bold text-rose-900">{d.doId}</td>
                            <td className="p-2.5 font-mono">{d.soId}</td>
                            <td className="p-2.5">{d.recipientName}</td>
                            <td className="p-2.5">{d.expedition}</td>
                            <td className="p-2.5 font-bold">{d.totalPcs} pcs</td>
                            <td className="p-2.5">{d.date}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.status === "CANCELLED" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                                {d.status || "DELIVERED"}
                              </span>
                            </td>
                            <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handlePrintDoLabel(d)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11px] font-bold shadow-xs"
                              >
                                🖨️ Cetak Label (Bluetooth)
                              </button>
                              {d.status !== "CANCELLED" && isRootAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDoCancelTarget(d);
                                    setDoCancelReason("");
                                    setIsDoCancelConfirmOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold shadow-xs"
                                >
                                  ✕ Batalkan DO
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
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
              <div className="flex gap-2 border-b border-rose-200 pb-2">
                {[
                  { key: "products", label: `Produk & Stok (${products.length})` },
                  { key: "card", label: "Kartu Mutasi (Stock Ledger)" },
                  { key: "adjustment", label: `Stock Adjustment (${stockAdjustments.length})` },
                  { key: "opname", label: "Stock Opname" },
                  { key: "movement", label: `Histori Mutasi (${stockMovements.length})` },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setInvSubTab(st.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      invSubTab === st.key ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* 3.1 PRODUK & STOK */}
              {invSubTab === "products" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Master Produk & Stok Gudang</span>
                      <p className="text-[11px] text-slate-500">Katalog dan kuantitas persediaan fisik terkini</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Cari Produk (SKU / Nama / Family)..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="p-1.5 px-3 border border-rose-200 rounded-lg text-xs outline-none w-full sm:w-64 bg-rose-50/40 focus:bg-white"
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
                            });
                            setIsProductModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow whitespace-nowrap"
                        >
                          + Tambah Produk Baru
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Family</th>
                          <th className="p-2.5">Nama Produk</th>
                          <th className="p-2.5">Stok Fisik</th>
                          <th className="p-2.5">HPP (Beli)</th>
                          <th className="p-2.5">Harga Jual</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {filteredProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-rose-50/40 transition">
                            <td className="p-2.5 font-mono font-bold text-rose-900 whitespace-nowrap">{p.sku}</td>
                            <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{p.familyCode || "-"}</td>
                            <td className="p-2.5 font-semibold text-rose-950">{p.itemName}</td>
                            <td className="p-2.5 font-bold text-emerald-600 whitespace-nowrap">{p.stock || 0} pcs</td>
                            <td className="p-2.5 whitespace-nowrap">{formatRupiah(Number(p.purchasingPrice || 0))}</td>
                            <td className="p-2.5 whitespace-nowrap font-bold text-rose-900">{formatRupiah(Number(p.netPrice || 0))}</td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                {p.active ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            <td className="p-2.5 text-right whitespace-nowrap">
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
                                  });
                                  setIsProductModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold shadow-xs"
                              >
                                ✏️ Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3.2 KARTU STOK / LEDGER */}
              {invSubTab === "card" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-xs font-bold text-rose-950">Buku Besar Kartu Mutasi (Stock Ledger)</span>
                    <input
                      type="text"
                      placeholder="Cari SKU / Nama Produk..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="w-64 px-3 py-1.5 border border-rose-200 rounded-lg text-xs outline-none bg-white"
                    />
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                      <tr>
                        <th className="p-2.5">SKU</th>
                        <th className="p-2.5">Nama Produk</th>
                        <th className="p-2.5">Saldo Stok Saat Ini</th>
                        <th className="p-2.5 text-right">Kartu Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                      {filteredLedgerProducts.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2.5 font-mono font-bold text-rose-900">{p.sku}</td>
                          <td className="p-2.5 font-medium">{p.itemName}</td>
                          <td className="p-2.5 font-bold text-emerald-600">{p.stock || 0} pcs</td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedProductLedger(p)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
                            >
                              🔍 Lihat Detail Mutasi
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
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Penyesuaian Stok (Stock Adjustment)</span>
                      <p className="text-[11px] text-slate-500">Koreksi saldo fisik secara atomik</p>
                    </div>
                    {!isStaff && (
                      <button
                        type="button"
                        onClick={() => setIsAdjModalOpen(true)}
                        className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                      >
                        + Buat Penyesuaian Stok
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
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
                      <tbody className="divide-y divide-rose-50">
                        {stockAdjustments.map((adj) => (
                          <tr key={adj.id} className="hover:bg-rose-50/40 transition">
                            <td className="p-2.5 font-mono font-bold text-rose-900">{adj.documentNo || adj.adjustmentId}</td>
                            <td className="p-2.5">{adj.date}</td>
                            <td className="p-2.5 font-mono font-bold">{adj.sku}</td>
                            <td className="p-2.5 font-medium">{adj.itemName}</td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${adj.adjustmentType === "INCREASE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                {adj.adjustmentType}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold">
                              {adj.adjustmentType === "INCREASE" ? `+${adj.adjustmentQty}` : `-${adj.adjustmentQty}`}
                            </td>
                            <td className="p-2.5 text-slate-500">{adj.currentStock ?? "-"}</td>
                            <td className="p-2.5 font-bold text-rose-950">{adj.newStock ?? "-"}</td>
                            <td className="p-2.5 max-w-xs truncate" title={adj.reason}>{adj.reason || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3.4 STOCK OPNAME */}
              {invSubTab === "opname" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Audit Fisik Stock Opname</span>
                      <p className="text-[11px] text-slate-500">Hasil audit mobile app direview dengan No Dokumen SRVW sebelum posting final</p>
                    </div>
                    {!isStaff && isRootAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsInitSopModalOpen(true)}
                        className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                      >
                        + Inisialisasi Stock Opname
                      </button>
                    )}
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                      <tr>
                        <th className="p-2.5">No Dokumen</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Total SKU</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Review / Post Ref</th>
                        <th className="p-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                      {stockOpnames.map((sop) => (
                        <tr key={sop.id}>
                          <td className="p-2.5 font-mono font-bold">{sop.documentNo || sop.sopId}</td>
                          <td className="p-2.5">{sop.opnameDate}</td>
                          <td className="p-2.5 font-bold">{sop.totalSku} SKU</td>
                          <td className="p-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              sop.status === "POSTED" ? "bg-emerald-100 text-emerald-800" :
                              sop.status === "CANCELLED" ? "bg-red-100 text-red-800" :
                              "bg-amber-100 text-amber-800"
                            }`}>
                              {sop.status}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">
                            {sop.postingId || sop.reviewDocumentNo || "-"}
                          </td>
                          <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                            {/* Tombol PDF merah murni */}
                            <button
                              type="button"
                              onClick={() => {
                                const rows = (sop.items || []).map((it: any) => [
                                  it.skuCode || it.skuId,
                                  it.itemName,
                                  it.systemQtySnapshot ?? 0,
                                  it.physicalQty ?? "-",
                                  (it.physicalQty != null ? Number(it.physicalQty) - Number(it.systemQtySnapshot || 0) : "-"),
                                ]);
                                downloadPdf(
                                  `Audit Report Stock Opname (${sop.documentNo || sop.sopId})`,
                                  `SOP_Item_Report_${sop.documentNo || sop.sopId}`,
                                  ["SKU", "Nama Produk", "Qty Sistem", "Qty Fisik", "Selisih"],
                                  rows
                                );
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold shadow-xs"
                            >
                              📄 Ekspor PDF
                            </button>

                            {sop.status !== "POSTED" && sop.status !== "CANCELLED" && (
                              <button
                                type="button"
                                onClick={() => handleOpenSopReview(sop)}
                                className="px-2.5 py-1 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded text-[11px] font-bold shadow-xs"
                              >
                                ✍️ Review & Post
                              </button>
                            )}

                            {sop.status !== "POSTED" && sop.status !== "CANCELLED" && !isStaff && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSopCancelTarget(sop);
                                  setSopCancelReason("");
                                  setSopCountdown(10);
                                  setIsSopCancelConfirmOpen(true);
                                }}
                                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[11px] font-bold shadow-xs"
                              >
                                ✕ Batalkan SOP
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3.5 HISTORI MUTASI */}
              {invSubTab === "movement" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-rose-950 uppercase">Histori Mutasi Stok (stock_movements)</span>
                    <span className="text-xs text-slate-500">Total: <b>{stockMovements.length}</b></span>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Nama Barang</th>
                          <th className="p-2.5">Tipe</th>
                          <th className="p-2.5">Masuk</th>
                          <th className="p-2.5">Keluar</th>
                          <th className="p-2.5">Stok Akhir</th>
                          <th className="p-2.5">Referensi</th>
                          <th className="p-2.5">Petugas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {stockMovements.map((m, idx) => (
                          <tr key={m.id || idx}>
                            <td className="p-2.5">{m.date}</td>
                            <td className="p-2.5 font-mono font-bold text-rose-900">{m.itemCode}</td>
                            <td className="p-2.5">{m.itemNameSnapshot}</td>
                            <td className="p-2.5 font-bold">{m.type}</td>
                            <td className="p-2.5 text-emerald-600 font-bold">{m.qtyIn > 0 ? `+${m.qtyIn}` : "-"}</td>
                            <td className="p-2.5 text-red-600 font-bold">{m.qtyOut > 0 ? `-${m.qtyOut}` : "-"}</td>
                            <td className="p-2.5 font-bold">{m.newStock}</td>
                            <td className="p-2.5 text-[11px] text-slate-600">{m.referenceId}</td>
                            <td className="p-2.5">{m.user}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PURCHASE ORDER & RECEIVING */}
          {currentTab === "purchase" && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-rose-200 pb-2">
                <button
                  type="button"
                  onClick={() => setPoSubTab("po_list")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    poSubTab === "po_list" ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                  }`}
                >
                  Purchase Orders ({purchaseOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPoSubTab("receiving_list")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    poSubTab === "receiving_list" ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                  }`}
                >
                  Receiving ({receivings.length})
                </button>
              </div>

              {/* 4.1 DAFTAR PO */}
              {poSubTab === "po_list" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Daftar Purchase Order</span>
                      <p className="text-[11px] text-slate-500">Pemesanan barang ke supplier berstatus rekanan</p>
                    </div>
                    {!isStaff && (
                      <button
                        type="button"
                        onClick={() => setIsCreatePoModalOpen(true)}
                        className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                      >
                        + Buat PO Baru
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">No PO</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Supplier</th>
                          <th className="p-2.5">Item Pesanan</th>
                          <th className="p-2.5">Total Nilai</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {purchaseOrders.map((po) => (
                          <tr key={po.id}>
                            <td className="p-2.5 font-mono font-bold text-rose-900">{po.poId || po.documentNo}</td>
                            <td className="p-2.5">{po.poDate}</td>
                            <td className="p-2.5 font-semibold">{po.supplier}</td>
                            <td className="p-2.5">
                              {(po.items || []).map((it: any, i: number) => (
                                <div key={i} className="text-[11px]">
                                  • {it.itemName} (Pesan: {it.qty} | Datang: {it.receivedQty || 0})
                                </div>
                              ))}
                            </td>
                            <td className="p-2.5 font-bold text-emerald-600">{formatRupiah(Number(po.total || 0))}</td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                po.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                                po.status === "OPEN" ? "bg-blue-100 text-blue-800" :
                                po.status === "PARTIAL" ? "bg-amber-100 text-amber-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                {po.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const rows = (po.items || []).map((it: any) => [
                                    it.sku,
                                    it.itemName,
                                    it.qty,
                                    formatRupiah(Number(it.purchasingPrice || 0)),
                                    formatRupiah(Number(it.subtotal || 0)),
                                  ]);
                                  downloadPdf(
                                    `Purchase Order (${po.poId || po.documentNo}) - Supplier: ${po.supplier}`,
                                    `PO_Report_${po.poId || po.documentNo}`,
                                    ["SKU", "Nama Barang", "Qty Pesan", "HPP", "Subtotal"],
                                    rows
                                  );
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold shadow-xs"
                              >
                                📄 Ekspor PDF
                              </button>
                              {po.status !== "COMPLETED" && po.status !== "CANCELLED" && !isStaff && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPoCancelTarget(po);
                                    setPoCancelReason("");
                                    setIsPoCancelConfirmOpen(true);
                                  }}
                                  className="px-2 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[11px] font-bold shadow-xs"
                                >
                                  Batal
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4.2 RECEIVING */}
              {poSubTab === "receiving_list" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Penerimaan Barang (Receiving)</span>
                      <p className="text-[11px] text-slate-500">Log bukti penerimaan barang masuk ke gudang</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">No. Receiving</th>
                          <th className="p-2.5">Ref No. PO</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Supplier</th>
                          <th className="p-2.5">Barang Diterima</th>
                          <th className="p-2.5">Petugas</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {receivings.map((r) => (
                          <tr key={r.id}>
                            <td className="p-2.5 font-mono font-bold text-rose-900">{r.receivingId || r.documentNo}</td>
                            <td className="p-2.5 font-mono text-blue-700 font-bold">{r.poId}</td>
                            <td className="p-2.5">{r.date}</td>
                            <td className="p-2.5 font-medium">{r.supplier || "-"}</td>
                            <td className="p-2.5">
                              {(r.items || []).map((it: any, i: number) => (
                                <div key={i} className="text-[11px]">• {it.itemName}: <b>{it.qtyReceived} pcs</b></div>
                              ))}
                            </td>
                            <td className="p-2.5">{r.createdBy}</td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const rows = (r.items || []).map((it: any) => [it.sku, it.itemName, `${it.qtyReceived} pcs`]);
                                  downloadPdf(
                                    `Bukti Penerimaan Barang (${r.receivingId || r.documentNo}) - Ref PO: ${r.poId}`,
                                    `RCV_${r.receivingId || r.documentNo}`,
                                    ["SKU", "Nama Produk Diterima", "Qty Diterima"],
                                    rows
                                  );
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold shadow-xs"
                              >
                                📄 Ekspor PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REPORTS */}
          {currentTab === "reports" && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-rose-200 pb-2">
                {[
                  { key: "so", label: "Report SO" },
                  { key: "do", label: "Report DO" },
                  { key: "po", label: "Report PO" },
                  { key: "receiving", label: "Receiving Report" },
                  { key: "opname", label: "Stock Opname Report" },
                  { key: "customer", label: "Customer Report" },
                  { key: "stock", label: "Stock Report" },
                  { key: "sales", label: "Sales Report (By Day/Item)" },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setReportSubTab(st.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      reportSubTab === st.key ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                {/* 5.1 REPORT SO (PDF Merah & Excel) */}
                {reportSubTab === "so" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-rose-950 uppercase">Laporan Sales Order</span>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                          <tr>
                            <th className="p-2">No SO</th>
                            <th className="p-2">Tanggal</th>
                            <th className="p-2">Customer</th>
                            <th className="p-2">Total Nilai</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {salesOrders.map((so) => (
                            <tr key={so.id}>
                              <td className="p-2 font-mono font-bold">{so.soId}</td>
                              <td className="p-2">{so.date}</td>
                              <td className="p-2">{so.customerName}</td>
                              <td className="p-2 font-bold text-emerald-600">{formatRupiah(Number(so.total || 0))}</td>
                              <td className="p-2 font-bold">{so.status}</td>
                              <td className="p-2 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (so.items || []).map((it: any) => [
                                      it.sku,
                                      it.itemName,
                                      it.qty || it.quantity,
                                      formatRupiah(Number(it.price || 0)),
                                      formatRupiah(Number(it.subtotal || 0)),
                                    ]);
                                    downloadPdf(
                                      `Sales Order Report (${so.soId}) - Customer: ${so.customerName}`,
                                      `SO_${so.soId}`,
                                      ["SKU", "Nama Barang", "Kuantitas", "Harga", "Subtotal"],
                                      rows
                                    );
                                  }}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                                >
                                  📄 Ekspor PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (so.items || []).map((it: any) => [
                                      so.soId,
                                      so.date,
                                      so.customerName,
                                      it.sku,
                                      it.itemName,
                                      it.qty || it.quantity,
                                      it.price,
                                      it.subtotal,
                                      so.total,
                                      so.status,
                                    ]);
                                    downloadExcel(
                                      so.soId,
                                      "SO_Report",
                                      ["No SO", "Tanggal", "Customer", "SKU", "Nama Barang", "Qty", "Harga", "Subtotal", "Total SO", "Status"],
                                      rows
                                    );
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                >
                                  📊 Ekspor Excel
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5.2 REPORT DO (PDF Merah & Excel) */}
                {reportSubTab === "do" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-rose-950 uppercase">Laporan Delivery Order</span>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                          <tr>
                            <th className="p-2">No DO</th>
                            <th className="p-2">Ref SO</th>
                            <th className="p-2">Tanggal</th>
                            <th className="p-2">Penerima</th>
                            <th className="p-2">Total Pcs</th>
                            <th className="p-2">Ekspedisi</th>
                            <th className="p-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {deliveryOrders.map((d) => (
                            <tr key={d.id}>
                              <td className="p-2 font-mono font-bold">{d.doId}</td>
                              <td className="p-2 font-mono">{d.soId}</td>
                              <td className="p-2">{d.recipientName}</td>
                              <td className="p-2 font-bold">{d.totalPcs} pcs</td>
                              <td className="p-2">{d.date}</td>
                              <td className="p-2">{d.expedition}</td>
                              <td className="p-2 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (d.items || []).map((it: any) => [it.sku, it.itemName, it.qty || it.quantity]);
                                    downloadPdf(
                                      `Delivery Order Report (${d.doId}) - Penerima: ${d.recipientName}`,
                                      `DO_${d.doId}`,
                                      ["SKU", "Nama Barang", "Kuantitas Pcs"],
                                      rows
                                    );
                                  }}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                                >
                                  📄 Ekspor PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (d.items || []).map((it: any) => [
                                      d.doId,
                                      d.soId,
                                      d.date,
                                      d.recipientName,
                                      it.sku,
                                      it.itemName,
                                      it.qty || it.quantity,
                                      d.expedition,
                                    ]);
                                    downloadExcel(
                                      d.doId,
                                      "DO_Report",
                                      ["No DO", "Ref SO", "Tanggal", "Penerima", "SKU", "Nama Barang", "Qty", "Ekspedisi"],
                                      rows
                                    );
                                  }}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                >
                                  📊 Ekspor Excel
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5.3 REPORT PO (PDF Merah) */}
                {reportSubTab === "po" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-rose-950 uppercase">Laporan Purchase Order</span>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                          <tr>
                            <th className="p-2">No PO</th>
                            <th className="p-2">Tanggal</th>
                            <th className="p-2">Supplier</th>
                            <th className="p-2">Total Nilai</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {purchaseOrders.map((po) => (
                            <tr key={po.id}>
                              <td className="p-2 font-mono font-bold">{po.poId || po.documentNo}</td>
                              <td className="p-2">{po.poDate}</td>
                              <td className="p-2">{po.supplier}</td>
                              <td className="p-2 font-bold text-emerald-600">{formatRupiah(Number(po.total || 0))}</td>
                              <td className="p-2 font-bold">{po.status}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (po.items || []).map((it: any) => [
                                      it.sku,
                                      it.itemName,
                                      it.qty,
                                      formatRupiah(Number(it.purchasingPrice || 0)),
                                      formatRupiah(Number(it.subtotal || 0)),
                                    ]);
                                    downloadPdf(
                                      `Purchase Order (${po.poId || po.documentNo})`,
                                      `PO_${po.poId || po.documentNo}`,
                                      ["SKU", "Nama Barang", "Qty Pesan", "HPP", "Subtotal"],
                                      rows
                                    );
                                  }}
                                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                                >
                                  📄 Ekspor PDF
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5.4 REPORT RECEIVING (PDF Merah) */}
                {reportSubTab === "receiving" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-rose-950 uppercase">Laporan Receiving</span>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                          <tr>
                            <th className="p-2">No Receiving</th>
                            <th className="p-2">Ref PO</th>
                            <th className="p-2">Tanggal</th>
                            <th className="p-2">Petugas</th>
                            <th className="p-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {receivings.map((r) => (
                            <tr key={r.id}>
                              <td className="p-2 font-mono font-bold">{r.receivingId}</td>
                              <td className="p-2 font-mono">{r.poId}</td>
                              <td className="p-2">{r.date}</td>
                              <td className="p-2">{r.createdBy}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rows = (r.items || []).map((it: any) => [it.sku, it.itemName, `${it.qtyReceived} pcs`]);
                                    downloadPdf(
                                      `Report Receiving (${r.receivingId})`,
                                      `RCV_${r.receivingId}`,
                                      ["SKU", "Nama Barang", "Qty Masuk"],
                                      rows
                                    );
                                  }}
                                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                                >
                                  📄 Ekspor PDF
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5.5 REPORT STOCK OPNAME (PDF Merah & Excel Lengkap) */}
                {reportSubTab === "opname" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-rose-950 uppercase">Laporan Stock Opname</span>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                          <tr>
                            <th className="p-2">No Dokumen</th>
                            <th className="p-2">Tanggal</th>
                            <th className="p-2">Total SKU</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {stockOpnames.map((sop) => {
                            const dateStr = sop.opnameDate || "-";
                            const docNo = sop.documentNo || sop.sopId;
                            const headers = ["date", "itemcode", "itemname", "qty asal", "qty hitung", "qty value", "qty variance", "counted by"];
                            const rows = (sop.items || []).map((it: any) => {
                              const orig = Number(it.systemQtySnapshot || 0);
                              const phys = it.physicalQty != null ? Number(it.physicalQty) : orig;
                              const variance = phys - orig;
                              return [
                                dateStr,
                                it.skuCode || it.skuId,
                                it.itemName,
                                orig,
                                phys,
                                phys,
                                variance,
                                it.countedBy || sop.initializedBy || "-",
                              ];
                            });

                            return (
                              <tr key={sop.id}>
                                <td className="p-2 font-mono font-bold">{docNo}</td>
                                <td className="p-2">{dateStr}</td>
                                <td className="p-2 font-bold">{sop.totalSku} SKU</td>
                                <td className="p-2 font-bold">{sop.status}</td>
                                <td className="p-2 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => downloadPdf(`Stock Opname Report (${docNo})`, `SOP_${docNo}`, headers, rows)}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                                  >
                                    📄 Ekspor PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadExcel(docNo, "SOP_Report", headers, rows)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                  >
                                    📊 Ekspor Excel
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

                {/* 5.6 REPORT CUSTOMER (ID CUST-XXXX yang sudah ditentukan) */}
                {reportSubTab === "customer" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-rose-950 uppercase">Laporan Data Customer Terdaftar</span>
                        <p className="text-[11px] text-slate-500">Total customer: <b>{customers.length}</b></p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const rows = customers.map((c, idx) => {
                              const determinedId = c.customerId?.startsWith("CUST-") ? c.customerId : `CUST-${String(idx + 1).padStart(4, "0")}`;
                              return [determinedId, c.customerName, c.phone || "-", c.email || "-", c.displayAddress || c.address || "-"];
                            });
                            downloadPdf(
                              "Laporan Daftar Customer Atin's Collection",
                              "Daftar_Customer",
                              ["ID Customer", "Nama Customer", "No. Telepon", "Email", "Alamat Pengiriman"],
                              rows
                            );
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs"
                        >
                          📄 Ekspor File PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rows = customers.map((c, idx) => {
                              const determinedId = c.customerId?.startsWith("CUST-") ? c.customerId : `CUST-${String(idx + 1).padStart(4, "0")}`;
                              return [determinedId, c.customerName, c.phone || "-", c.email || "-", c.displayAddress || c.address || "-"];
                            });
                            downloadExcel(
                              "ALL",
                              "Customer_List",
                              ["ID Customer", "Nama", "Telepon", "Email", "Alamat"],
                              rows
                            );
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs"
                        >
                          📊 Ekspor Excel
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                          <tr>
                            <th className="p-2.5">ID Customer</th>
                            <th className="p-2.5">Nama Customer</th>
                            <th className="p-2.5">No. Telepon</th>
                            <th className="p-2.5">Email</th>
                            <th className="p-2.5">Alamat Pengiriman</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {customers.map((c, idx) => {
                            const determinedId = c.customerId?.startsWith("CUST-") ? c.customerId : `CUST-${String(idx + 1).padStart(4, "0")}`;
                            return (
                              <tr key={c.id}>
                                <td className="p-2.5 font-mono font-bold text-rose-900">{determinedId}</td>
                                <td className="p-2.5 font-bold">{c.customerName}</td>
                                <td className="p-2.5 font-mono">{c.phone || "-"}</td>
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

                {/* 5.7 REPORT STOCK & SALES */}
                {reportSubTab === "stock" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-rose-950 uppercase">Laporan Saldo Persediaan Produk</span>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold">
                          <tr><th className="p-2">SKU</th><th className="p-2">Nama Produk</th><th className="p-2.5">Stok Fisik</th><th className="p-2">HPP (Beli)</th><th className="p-2">Harga Net</th></tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {products.map((p) => (
                            <tr key={p.id}><td className="p-2 font-mono font-bold">{p.sku}</td><td className="p-2 font-semibold">{p.itemName}</td><td className="p-2 font-bold text-emerald-600">{p.stock || 0} pcs</td><td className="p-2">{formatRupiah(Number(p.purchasingPrice || 0))}</td><td className="p-2">{formatRupiah(Number(p.netPrice || 0))}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {reportSubTab === "sales" && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-rose-950 uppercase">Laporan Penjualan (Sales)</span>
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold">
                          <tr><th className="p-2">No DO / Tanggal</th><th className="p-2">Penerima</th><th className="p-2">Total Pcs</th><th className="p-2">Total Nilai</th></tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {deliveryOrders.map((d) => (
                            <tr key={d.id}><td className="p-2 font-mono font-bold">{d.doId} ({d.date})</td><td className="p-2">{d.recipientName}</td><td className="p-2 font-bold">{d.totalPcs} pcs</td><td className="p-2 font-bold text-emerald-600">{formatRupiah((d.items || []).reduce((acc: number, it: any) => acc + (it.subtotal || 0), 0))}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {currentTab === "settings" && (
            <div className="max-w-3xl bg-white rounded-2xl border border-rose-100 p-6 shadow-sm space-y-6">
              {/* HARDWARE PRINTER BLUETOOTH */}
              <div className="border-b border-rose-100 pb-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-rose-950 uppercase">Hardware Printer Thermal Bluetooth</h3>
                  <p className="text-xs text-rose-500">Pindai dan hubungkan printer Bluetooth untuk direct printing ESC/POS Label DO</p>
                </div>

                <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-rose-900">Perangkat Bluetooth:</span>
                      <div className="font-bold text-rose-950 text-sm mt-0.5">{storeSettings.btPrinterDeviceName || btStatus}</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleScanBluetoothPrinter}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold shadow-xs"
                    >
                      🔍 Cari Printer Bluetooth
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="font-semibold block mb-1">Ukuran Kertas Thermal Struk / Label</label>
                      <select
                        value={storeSettings.labelSize}
                        onChange={(e) => setStoreSettings({ ...storeSettings, labelSize: e.target.value })}
                        className="w-full p-2 border border-rose-200 rounded-lg font-bold text-[#BE185D] outline-none bg-white"
                      >
                        <option value="58mm">58mm (Mini Thermal)</option>
                        <option value="80mm">80mm (Standard)</option>
                        <option value="100mm">100mm (Label Resi)</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setLoading(true);
                            await setDoc(doc(db, "settings", "store_info"), storeSettings, { merge: true });
                            showAlert("Pengaturan printer dan toko berhasil disimpan!", "Sukses");
                          } catch (e: any) {
                            showAlert(e.message || "Gagal menyimpan pengaturan.");
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="w-full py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded-lg font-bold shadow"
                      >
                        💾 Simpan Pengaturan Printer
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ALAMAT ASAL PENGIRIMAN TOKO */}
              <div className="border-b border-rose-100 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-rose-950 uppercase">Alamat Asal Pengiriman Toko</h3>
                    <p className="text-xs text-rose-500">Wajib dipilih bertingkat dari basis data wilayah resmi Indonesia</p>
                  </div>
                  {loadingRegion && <span className="text-[11px] text-rose-600 animate-pulse font-medium">Memuat data wilayah...</span>}
                </div>

                <form onSubmit={handleSaveStoreAddress} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1">Nama Toko</label>
                      <input
                        type="text"
                        required
                        value={storeSettings.storeName}
                        onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
                        className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">No. Handphone Toko</label>
                      <input
                        type="text"
                        required
                        value={storeSettings.storePhone}
                        onChange={(e) => setStoreSettings({ ...storeSettings, storePhone: e.target.value })}
                        className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1 text-rose-900">1. Provinsi</label>
                      <select
                        required
                        value={storeSettings.provinceCode}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                        className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none"
                      >
                        <option value="">-- Pilih Provinsi --</option>
                        {provinces.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-rose-900">2. Kabupaten / Kota</label>
                      <select
                        required
                        disabled={!storeSettings.provinceCode || regencies.length === 0}
                        value={storeSettings.regencyCode}
                        onChange={(e) => handleRegencyChange(e.target.value)}
                        className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                      >
                        <option value="">-- Pilih Kabupaten/Kota --</option>
                        {regencies.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-rose-900">3. Kecamatan</label>
                      <select
                        required
                        disabled={!storeSettings.regencyCode || districts.length === 0}
                        value={storeSettings.districtCode}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                      >
                        <option value="">-- Pilih Kecamatan --</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold block mb-1 text-rose-900">4. Desa / Kelurahan</label>
                      <select
                        required
                        disabled={!storeSettings.districtCode || villages.length === 0}
                        value={storeSettings.villageCode}
                        onChange={(e) => handleVillageChange(e.target.value)}
                        className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none disabled:bg-slate-100"
                      >
                        <option value="">-- Pilih Desa/Kelurahan --</option>
                        {villages.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="font-semibold block mb-1">Detail Alamat (Jalan, RT/RW, Patokan)</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="misal: Jl. Raya Banjaran No. 120 RT 02/05"
                      value={storeSettings.detailAddress}
                      onChange={(e) => setStoreSettings({ ...storeSettings, detailAddress: e.target.value })}
                      className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                    />
                  </div>

                  <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-lg text-xs space-y-1">
                    <div className="font-bold text-rose-950">Alamat Terformat:</div>
                    <div className="text-rose-800">{storeSettings.storeAddress || "Belum disimpan"}</div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold shadow"
                    >
                      Simpan Alamat Toko
                    </button>
                  </div>
                </form>
              </div>

              {/* PENGATURAN API KEY RAJAONGKIR */}
              <div className="space-y-4 text-xs">
                <div>
                  <h3 className="text-sm font-bold text-rose-950 uppercase">Pengaturan API Key RajaOngkir (Komerce v1)</h3>
                  <p className="text-rose-500">Uji koneksi terlebih dahulu. Tombol simpan hanya aktif jika API berhasil bekerja.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-semibold block mb-1 text-slate-700">Input RajaOngkir API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Tempelkan API Key di sini..."
                        value={inputApiKey}
                        onChange={(e) => {
                          setInputApiKey(e.target.value);
                          setApiKeyTestedSuccess(false);
                          setTestedToken(null);
                        }}
                        className="flex-1 p-2 border border-rose-200 rounded-lg font-mono font-bold text-[#BE185D] outline-none"
                      />
                      <button
                        type="button"
                        disabled={isTestingApiKey || !inputApiKey.trim()}
                        onClick={handleTestApiKey}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white rounded-lg font-bold"
                      >
                        {isTestingApiKey ? "Menguji..." : "🔍 Uji Koneksi"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600">Status Pengujian:</span>
                    {apiKeyTestedSuccess ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                        ✓ Terverifikasi Bisa Bekerja
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px]">
                        Belum Diuji / Menunggu Pengujian
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-rose-100 flex justify-end">
                    <button
                      type="button"
                      disabled={!apiKeyTestedSuccess || isSavingApiKey}
                      onClick={handleConfirmAndSaveApiKey}
                      className="px-5 py-2.5 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow transition"
                    >
                      {isSavingApiKey ? "Menyimpan..." : "Konfirmasi & Simpan API Key"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: HUMAN (STAFF CRUD, SUPPLIER CRUD, & CUSTOMER CRUD) */}
          {currentTab === "human" && isRootAdmin && (
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-rose-200 pb-2">
                <button
                  type="button"
                  onClick={() => setHumanSubTab("staff")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    humanSubTab === "staff" ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                  }`}
                >
                  Staff Gudang ({usersList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHumanSubTab("suppliers")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    humanSubTab === "suppliers" ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                  }`}
                >
                  Supplier Rekanan ({suppliers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHumanSubTab("customers")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    humanSubTab === "customers" ? "bg-[#BE185D] text-white shadow" : "bg-white text-rose-900 border border-rose-200"
                  }`}
                >
                  Daftar Customer ({customers.length})
                </button>
              </div>

              {/* 7.1 STAFF GUDANG (CRUD LENGKAP AUTO ST-xx) */}
              {humanSubTab === "staff" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Daftar Akun Staff (ST-xx)</span>
                      <p className="text-[11px] text-slate-500">Hanya Root Admin yang dapat mengelola akun operasional staf</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddStaff}
                      className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                    >
                      + Tambah Staff Baru
                    </button>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">ID Staff</th>
                          <th className="p-2.5">User ID / Username</th>
                          <th className="p-2.5">Nama Lengkap</th>
                          <th className="p-2.5">Role</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {usersList.map((u, idx) => {
                          const displayStaffId = u.staffId || `ST-${String(idx + 1).padStart(2, "0")}`;
                          const isRoot = u.userId === "admin" || String(u.role).toLowerCase().includes("root");
                          return (
                            <tr key={u.id || u.userId}>
                              <td className="p-2.5 font-mono font-bold text-rose-900">{displayStaffId}</td>
                              <td className="p-2.5 font-mono text-slate-700">{u.userId || u.username}</td>
                              <td className="p-2.5 font-semibold text-rose-950">{u.fullName || u.name}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isRoot ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                                  {u.role || "Staff Gudang"}
                                </span>
                              </td>
                              <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                                {!isRoot && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStaffForm({
                                          staffId: displayStaffId,
                                          fullName: u.fullName || u.name || "",
                                          userId: u.userId || u.username || "",
                                          password: u.password || "",
                                        });
                                        setStaffModalMode("edit");
                                        setIsStaffModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold"
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStaff(u)}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                                    >
                                      Hapus
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7.2 SUPPLIER REKANAN (CRUD LENGKAP) */}
              {humanSubTab === "suppliers" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Daftar Supplier Rekanan (SUPP-XXXX)</span>
                      <p className="text-[11px] text-slate-500">Kelola katalog vendor rekanan resmi</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddSupplier}
                      className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                    >
                      + Tambah Supplier Baru
                    </button>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">Kode Supplier</th>
                          <th className="p-2.5">Nama Supplier</th>
                          <th className="p-2.5">No. Handphone</th>
                          <th className="p-2.5">Alamat Lengkap</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {suppliers.map((s) => (
                          <tr key={s.id || s.supplierId}>
                            <td className="p-2.5 font-mono font-bold text-rose-900">{s.supplierId || s.documentNo}</td>
                            <td className="p-2.5 font-bold">{s.supplierName}</td>
                            <td className="p-2.5 font-mono">{s.phone}</td>
                            <td className="p-2.5">{s.address}</td>
                            <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupplier(s);
                                  setIsSupplierModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSupplier(s)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7.3 DAFTAR CUSTOMER CRUD */}
              {humanSubTab === "customers" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Kelola Data Customer (CUST-XXXX)</span>
                      <p className="text-[11px] text-slate-500">Basis data pelanggan dan tujuan pengiriman</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerModalMode("create");
                        setCustomerForm({ customerId: "", customerName: "", phone: "", email: "", address: "", displayAddress: "" });
                        setIsCustomerModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                    >
                      + Tambah Customer Baru
                    </button>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">ID Customer</th>
                          <th className="p-2.5">Nama Customer</th>
                          <th className="p-2.5">No. Telepon / WA</th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Alamat Pengiriman</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {customers.map((c, idx) => {
                          const determinedId = c.customerId?.startsWith("CUST-") ? c.customerId : `CUST-${String(idx + 1).padStart(4, "0")}`;
                          return (
                            <tr key={c.id}>
                              <td className="p-2.5 font-mono font-bold text-rose-900">{determinedId}</td>
                              <td className="p-2.5 font-bold">{c.customerName}</td>
                              <td className="p-2.5 font-mono">{c.phone || "-"}</td>
                              <td className="p-2.5">{c.email || "-"}</td>
                              <td className="p-2.5 max-w-xs truncate">{c.displayAddress || c.address || "-"}</td>
                              <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomerModalMode("edit");
                                    setCustomerForm({
                                      customerId: c.id || c.customerId,
                                      customerName: c.customerName,
                                      phone: c.phone || "",
                                      email: c.email || "",
                                      address: c.address || "",
                                      displayAddress: c.displayAddress || c.address || "",
                                    });
                                    setIsCustomerModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomer(c)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                                >
                                  Hapus
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
            </div>
          )}
        </section>
      </main>

      {/* MODAL DETAIL SO & ACTION */}
      {isSoDetailModalOpen && selectedSoDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-rose-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-rose-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-rose-950">Detail Sales Order: {selectedSoDetail.soId}</h3>
                <span className="text-xs text-rose-600 font-medium">Status: <b>{selectedSoDetail.status}</b></span>
              </div>
              <button
                type="button"
                onClick={() => setIsSoDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
              <div>
                <div className="text-slate-500">Customer:</div>
                <div className="font-bold text-rose-950">{selectedSoDetail.customerName} ({selectedSoDetail.phone})</div>
                <div className="text-[11px] text-slate-600 mt-1">{selectedSoDetail.address}</div>
              </div>
              <div>
                <div className="text-slate-500">Pengiriman:</div>
                <div className="font-bold">{selectedSoDetail.shippingServiceName || selectedSoDetail.expedition}</div>
                <div className="text-emerald-700 font-bold">Ongkir: {formatRupiah(Number(selectedSoDetail.shippingCost || 0))}</div>
                <div className="text-rose-900 font-bold text-sm mt-1">Total: {formatRupiah(Number(selectedSoDetail.total || 0))}</div>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-xs font-bold text-rose-950 block mb-2">Rincian SKU Barang:</span>
              <table className="w-full text-xs text-left border border-rose-100 rounded-lg overflow-hidden">
                <thead className="bg-rose-50 text-rose-900 font-bold">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Nama Barang</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Harga</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {(selectedSoDetail.items || []).map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 font-mono font-bold text-rose-900">{it.sku}</td>
                      <td className="p-2">{it.itemName}</td>
                      <td className="p-2 text-center font-bold">{it.qty || it.quantity}</td>
                      <td className="p-2 text-right">{formatRupiah(Number(it.price || 0))}</td>
                      <td className="p-2 text-right font-bold">{formatRupiah(Number(it.subtotal || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-rose-100">
              <button
                type="button"
                onClick={() => {
                  const msg = buildWhatsAppMessage(selectedSoDetail);
                  const clean = String(selectedSoDetail.phone || "").replace(/[^0-9]/g, "");
                  const phoneNum = clean.startsWith("0") ? "62" + clean.slice(1) : clean;
                  window.open(`https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                💬 Kirim WA
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
                      setSoModalInitCourier(selectedSoDetail.shippingCourier || "");
                      setSoModalInitService(selectedSoDetail.shippingServiceName || "");
                      setIsSoDetailModalOpen(false);
                      setIsSoModalOpen(true);
                    }}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg"
                  >
                    ✏️ Edit SO
                  </button>
                  <button
                    type="button"
                    onClick={() => executeMarkProcessing(selectedSoDetail)}
                    className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow"
                  >
                    ⏩ PROCESSING
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
                        rates = [{ courier: selectedSoDetail.shippingCourier || "JNE", serviceName: selectedSoDetail.shippingServiceName || "REG", cost: Number(selectedSoDetail.shippingCost || 0), etd: "1-3 Hari" }];
                      }
                      setTargetProcessingSo({ ...selectedSoDetail, shippingRatesSnapshot: rates });
                      setIsEditExpeditionModalOpen(true);
                    }}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
                  >
                    🚚 Ganti Ekspedisi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkReadyToDeliver(selectedSoDetail)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg"
                  >
                    📦 READY TO DELIVER
                  </button>
                </>
              )}

              {selectedSoDetail.status === "READY TO DELIVER" && (
                <button
                  type="button"
                  onClick={() => handleProcessDO(selectedSoDetail)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow"
                >
                  🚀 Terbitkan Delivery Order (DO)
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
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  ✕ Batalkan SO
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL STOCK OPNAME REVIEW */}
      {isSopReviewModalOpen && reviewSopTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl border border-rose-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-rose-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-rose-950">Review Hasil Perhitungan Stock Opname</h3>
                <p className="text-xs text-rose-600 font-mono">
                  Dokumen: {reviewSopTarget.documentNo || reviewSopTarget.sopId} | Kode Review: SRVW-20261016-XXXX
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportSopReviewExcel}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                📊 Ekspor Excel Hasil Review
              </button>
            </div>

            <div className="overflow-x-auto text-xs mb-4">
              <table className="w-full text-left border border-rose-100 rounded-lg">
                <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                  <tr>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Nama Barang</th>
                    <th className="p-2 text-center">Qty Asal</th>
                    <th className="p-2 text-center w-28">Qty Hitung (Edit)</th>
                    <th className="p-2 text-center">Qty Variance</th>
                    <th className="p-2">Counted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {reviewItemsData.map((it, idx) => {
                    const sys = Number(it.systemQtySnapshot || 0);
                    const phys = it.physicalQty != null ? Number(it.physicalQty) : sys;
                    const diff = phys - sys;
                    return (
                      <tr key={idx}>
                        <td className="p-2 font-mono font-bold text-rose-900">{it.skuCode || it.skuId}</td>
                        <td className="p-2">{it.itemName}</td>
                        <td className="p-2 text-center font-bold text-slate-600">{sys} pcs</td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={phys}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setReviewItemsData((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, physicalQty: val, adjustmentQty: val - sys } : item))
                              );
                            }}
                            className="w-20 p-1 border border-rose-300 rounded font-bold text-center outline-none bg-rose-50/30"
                          />
                        </td>
                        <td className={`p-2 text-center font-bold ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-500"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="p-2 text-slate-500">{it.countedBy || currentUser.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-rose-100">
              <button
                type="button"
                onClick={() => setIsSopReviewModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleConfirmPostStockOpname}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow"
              >
                ✓ Selesai Review & Posting (POST-20261016-XXXX)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEMBATALAN SO */}
      {isSoCancelConfirmOpen && soCancelTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-200">
            <h3 className="text-base font-bold text-red-950 mb-1">Batalkan Sales Order</h3>
            <p className="text-xs text-red-600 font-mono font-bold mb-3">No SO: {soCancelTarget.soId}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Pembatalan (Wajib)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ketik alasan pembatalan SO..."
                  value={soCancelReason}
                  onChange={(e) => setSoCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-rose-200 rounded-lg text-xs outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsSoCancelConfirmOpen(false)} className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold">Tutup</button>
                <button type="button" onClick={executeCancelSo} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow">Konfirmasi Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEMBATALAN DO (ROOT ADMIN ONLY) */}
      {isDoCancelConfirmOpen && doCancelTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-300">
            <div className="text-red-600 text-2xl mb-1">⚠️</div>
            <h3 className="text-base font-bold text-red-950 mb-1">Konfirmasi Pembatalan Delivery Order</h3>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Pembatalan DO <b>{doCancelTarget.doId}</b> akan mengembalikan saldo stok ke master produk dan mencatatnya ke buku mutasi (ledger).
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Pembatalan (Wajib):</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ketik alasan pembatalan DO..."
                  value={doCancelReason}
                  onChange={(e) => setDoCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-rose-200 rounded-lg outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsDoCancelConfirmOpen(false)} className="px-3 py-2 bg-slate-100 rounded-lg font-bold">Batal</button>
                <button type="button" onClick={executeCancelDo} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow">Konfirmasi Batalkan DO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH/EDIT STAFF (ST-xx) */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-rose-100">
            <h3 className="text-base font-bold text-rose-950 mb-3">
              {staffModalMode === "create" ? "Tambah Staff Baru" : `Edit Akun Staff (${staffForm.userId})`}
            </h3>
            <form onSubmit={handleSaveStaff} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">ID Staff (Otomatis)</label>
                <input
                  type="text"
                  disabled
                  value={staffForm.staffId}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 font-mono font-bold text-rose-900 select-none outline-none"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="misal: Ahmad Fauzi"
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">ID / Username Login *</label>
                <input
                  type="text"
                  required
                  disabled={staffModalMode === "edit"}
                  placeholder="misal: ahmad_staff"
                  value={staffForm.userId}
                  onChange={(e) => setStaffForm({ ...staffForm, userId: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none font-mono disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Masukkan kata sandi..."
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
                <button type="button" onClick={() => setIsStaffModalOpen(false)} className="px-3.5 py-1.5 bg-slate-100 rounded-lg font-bold">Batal</button>
                <button type="submit" className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded-lg font-bold shadow">
                  {staffModalMode === "create" ? "Simpan Staff" : "Perbarui Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CRUD CUSTOMER */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-rose-100">
            <h3 className="text-base font-bold text-rose-950 mb-3">
              {customerModalMode === "create" ? "Tambah Customer Baru" : `Edit Data Customer (${customerForm.customerId})`}
            </h3>
            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Nama Customer *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Customer"
                  value={customerForm.customerName}
                  onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">No. Handphone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="08xxxxxxxx"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Email</label>
                <input
                  type="email"
                  placeholder="customer@domain.com"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Alamat Lengkap Pengiriman</label>
                <textarea
                  rows={2}
                  placeholder="Jalan, No Rumah, RT/RW, Kota, Kode Pos"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value, displayAddress: e.target.value })}
                  className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="px-3.5 py-1.5 bg-slate-100 rounded-lg font-bold">Batal</button>
                <button type="submit" className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded-lg font-bold shadow">Simpan Customer</button>
              </div>
            </form>
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
        onConfirmSave={async (savedData: any) => {
          setIsProductModalOpen(false);
          loadAllData();
        }}
      />

      <StockAdjustmentModal
        isOpen={isAdjModalOpen}
        products={products}
        onClose={() => setIsAdjModalOpen(false)}
        onExecuteAdjustment={async () => {
          setIsAdjModalOpen(false);
          loadAllData();
        }}
        showAlert={showAlert}
      />

      <StockOpnameModal
        isOpen={isInitSopModalOpen}
        products={products}
        families={families}
        currentUserName={currentUser.name}
        onClose={() => setIsInitSopModalOpen(false)}
        onConfirmInit={async () => {
          setIsInitSopModalOpen(false);
          loadAllData();
        }}
        showAlert={showAlert}
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
        onSaveSo={async () => {
          setIsSoModalOpen(false);
          loadAllData();
        }}
        showAlert={showAlert}
      />

      <CreatePurchaseOrderModal
        isOpen={isCreatePoModalOpen}
        products={products}
        suppliers={suppliers}
        onClose={() => setIsCreatePoModalOpen(false)}
        onSubmitPo={async () => {
          setIsCreatePoModalOpen(false);
          loadAllData();
        }}
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
        onSave={handleSaveSupplier}
      />

      {/* ALERT MODAL */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-70">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-100 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-2">{alertModal.title}</h3>
            <p className="text-xs text-rose-700 mb-5">{alertModal.message}</p>
            <button
              type="button"
              onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })}
              className="w-full py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-xl shadow"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRM MODAL */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-70 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-100 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-1">Konfirmasi Keluar Akun</h3>
            <p className="text-xs text-rose-700 mb-6 leading-relaxed">
              Apakah Anda yakin ingin keluar dari sesi <b>{currentUser.name}</b>?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                  router.push("/login");
                }}
                className="flex-1 py-2 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-bold rounded-xl shadow"
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