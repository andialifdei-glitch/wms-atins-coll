"use client";

import React, { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { formatRupiah, buildWhatsAppMessage } from "@/lib/formatters";
import ProductModal from "@/components/modals/ProductModal";
import StockAdjustmentModal from "@/components/modals/StockAdjustmentModal";
import StockOpnameModal from "@/components/modals/StockOpnameModal";
import SalesOrderModal from "@/components/modals/SalesOrderModal";
import CreatePurchaseOrderModal from "@/components/modals/CreatePurchaseOrderModal";
import ReceivingModal from "@/components/modals/ReceivingModal";

type MainTab = "dashboard" | "sales" | "inventory" | "purchase" | "reports" | "settings";

interface RegionItem {
  id: string;
  name: string;
}

export default function Page() {
  const [currentTab, setCurrentTab] = useState<MainTab>("dashboard");
  const [salesSubTab, setSalesSubTab] = useState<"so" | "do">("so");
  const [invSubTab, setInvSubTab] = useState<string>("products");
  const [poSubTab, setPoSubTab] = useState<string>("po_list");
  const [reportSubTab, setReportSubTab] = useState<"so" | "do" | "po" | "receiving" | "opname" | "stock" | "sales">("so");

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
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Store Settings
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
  });

  // Wilayah
  const [provinces, setProvinces] = useState<RegionItem[]>([]);
  const [regencies, setRegencies] = useState<RegionItem[]>([]);
  const [districts, setDistricts] = useState<RegionItem[]>([]);
  const [villages, setVillages] = useState<RegionItem[]>([]);
  const [loadingRegion, setLoadingRegion] = useState(false);

  // API Key
  const [inputApiKey, setInputApiKey] = useState("");
  const [apiKeyTestedSuccess, setApiKeyTestedSuccess] = useState(false);
  const [testedToken, setTestedToken] = useState<string | null>(null);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isApiSuccessModalOpen, setIsApiSuccessModalOpen] = useState(false);

  // User Session
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string; username?: string }>({
    id: "admin",
    role: "Root Admin",
    name: "Root Administrator",
    username: "admin",
  });

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });

  // Modal State
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

  const [soStatusFilter, setSoStatusFilter] = useState<string>("ALL");
  const [processingConfirmTarget, setProcessingConfirmTarget] = useState<any | null>(null);
  const [isEditExpeditionModalOpen, setIsEditExpeditionModalOpen] = useState(false);
  const [targetProcessingSo, setTargetProcessingSo] = useState<any | null>(null);

  // PO & Receiving Modal State
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [selectedPoForReceiving, setSelectedPoForReceiving] = useState<any | null>(null);

  // Logout Confirm State
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Kartu Stok & Pembatalan
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [selectedProductLedger, setSelectedProductLedger] = useState<any | null>(null);
  const [sopCancelTarget, setSopCancelTarget] = useState<any | null>(null);
  const [sopCancelReason, setSopCancelReason] = useState("");
  const [sopCountdown, setSopCountdown] = useState(10);
  const [isSopCancelConfirmOpen, setIsSopCancelConfirmOpen] = useState(false);
  const [poCancelTarget, setPoCancelTarget] = useState<any | null>(null);
  const [poCancelReason, setPoCancelReason] = useState("");
  const [isPoCancelConfirmOpen, setIsPoCancelConfirmOpen] = useState(false);

  // Report Filter
  const [salesReportType, setSalesReportType] = useState<"day" | "item" | "summary">("summary");

  const router = useRouter();

  const isRootAdmin = useMemo(() => {
    const roleClean = String(currentUser.role || "").trim().toLowerCase();
    const userClean = String(currentUser.username || currentUser.id || "").trim().toLowerCase();
    return userClean === "admin" || roleClean.includes("root");
  }, [currentUser]);

  const showAlert = (message: string, title = "Informasi") => {
    setAlertModal({ isOpen: true, title, message });
  };

  function handleExecuteLogout() {
    setIsLogoutConfirmOpen(false);
    document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    router.push("/login");
  }

  useEffect(() => {
    if (!isSopCancelConfirmOpen) {
      setSopCountdown(10);
      return;
    }
    if (sopCountdown > 0) {
      const timer = setTimeout(() => setSopCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isSopCancelConfirmOpen, sopCountdown]);

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

  async function loadAllData() {
    setLoading(true);
    try {
      const [
        pSnap, fSnap, cSnap, soSnap, doSnap, poSnap, rcvSnap, sopSnap, adjSnap, mvSnap, setDocSnap
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

      const foundSettings = setDocSnap.docs.find((d) => d.id === "store_info");
      if (foundSettings) {
        const data = foundSettings.data();
        setStoreSettings((prev) => ({ ...prev, ...data }));
        if (data.rajaOngkirApiKey) {
          setInputApiKey(data.rajaOngkirApiKey);
        }
      }
    } catch (err: any) {
      console.error("Gagal load Firestore:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (currentTab === "settings" && provinces.length === 0) {
      setLoadingRegion(true);
      fetch("/api/regions")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setProvinces(data);
        })
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
    } finally {
      setLoadingRegion(false);
    }
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
    } finally {
      setLoadingRegion(false);
    }
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
    } finally {
      setLoadingRegion(false);
    }
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
      await setDoc(
        doc(db, "settings", "store_info"),
        {
          ...storeSettings,
          storeAddress: fullAddr,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name,
        },
        { merge: true }
      );
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
        body: JSON.stringify({
          action: "TEST_CONNECTION",
          apiKey: inputApiKey.trim(),
          userRole: currentUser.role,
        }),
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
    if (!apiKeyTestedSuccess || !testedToken) {
      return showAlert("API Key harus diuji terlebih dahulu!", "Peringatan");
    }

    setIsSavingApiKey(true);
    try {
      const res = await fetch("/api/shipping/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM_AND_SAVE",
          apiKey: inputApiKey.trim(),
          userRole: currentUser.role,
          token: testedToken,
        }),
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

  async function handleSaveProduct(savedData: any) {
    try {
      setLoading(true);
      if (isEditingProduct) {
        if (!isRootAdmin) return showAlert("Hanya Root Admin yang berhak mengedit produk.");
        await updateDoc(doc(db, "products", savedData.sku), {
          itemName: savedData.itemName.trim(),
          purchasingPrice: Number(savedData.purchasingPrice),
          netPrice: Number(savedData.netPrice),
          active: Boolean(savedData.active),
          status: savedData.active ? "ACTIVE" : "INACTIVE",
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name,
        });
        showAlert(`Parameter produk ${savedData.sku} berhasil diperbarui.`);
      } else {
        const famCode = savedData.familyCode.trim() || families[0]?.familyCode || "FAM-001";
        const famNum = parseInt(famCode.replace(/[^0-9]/g, ""), 10) || 1;
        const initStock = Number(savedData.initialStock) || 0;

        await runTransaction(db, async (tx) => {
          const fCountRef = doc(db, "family_counters", famCode);
          const fSnap = await tx.get(fCountRef);
          const curSeq = fSnap.exists() ? (fSnap.data().currentProductNumber || 0) : 0;
          const nextSeq = curSeq + 1;
          const candidateSku = `SKU-${String(famNum).padStart(3, "0")}${String(nextSeq).padStart(3, "0")}`;

          tx.set(fCountRef, { familyCode: famCode, currentProductNumber: nextSeq, updatedAt: serverTimestamp() });
          tx.set(doc(db, "products", candidateSku), {
            productId: candidateSku,
            sku: candidateSku,
            familyCode: famCode,
            itemName: savedData.itemName.trim(),
            lastReceiving: "-",
            stock: initStock,
            purchasingPrice: Number(savedData.purchasingPrice),
            netPrice: Number(savedData.netPrice),
            weightInGrams: Number(savedData.weightInGrams) || 0,
            active: Boolean(savedData.active),
            status: savedData.active ? "ACTIVE" : "INACTIVE",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: currentUser.name,
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
              reason: "Inisialisasi Stok Awal Produk",
              user: currentUser.name,
              timestamp: serverTimestamp(),
            });
          }
        });
        showAlert("Produk baru berhasil disimpan!");
      }
      setIsProductModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan data produk.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteStockAdjustment(formData: any) {
    try {
      setLoading(true);
      const prod = products.find((p) => p.sku === formData.sku);
      if (!prod) throw new Error("Produk tidak ditemukan!");

      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];
      const adjId = `Adj-${dateStr}-${String(Math.floor(1000 + Math.random() * 9000))}`;

      await runTransaction(db, async (tx) => {
        const pRef = doc(db, "products", formData.sku);
        const pSnap = await tx.get(pRef);
        if (!pSnap.exists()) throw new Error("Produk tidak ditemukan!");

        const currentStock = Number(pSnap.data()?.stock || 0);
        const newStock = formData.type === "INCREASE"
          ? currentStock + formData.qty
          : currentStock - formData.qty;

        if (formData.type === "DECREASE" && currentStock < formData.qty) {
          throw new Error(`Stok saat ini (${currentStock}) tidak cukup untuk dikurangi ${formData.qty}!`);
        }

        tx.update(pRef, {
          stock: newStock,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name,
        });

        tx.set(doc(db, "stock_adjustments", adjId), {
          adjustmentId: adjId,
          documentNo: adjId,
          date: displayDate,
          sku: formData.sku,
          itemName: prod.itemName,
          currentStock: currentStock,
          adjustmentType: formData.type,
          adjustmentQty: formData.qty,
          newStock: newStock,
          reason: formData.reason.trim(),
          notes: formData.notes.trim(),
          user: currentUser.name,
          status: "COMPLETED",
          executedBy: currentUser.name,
          executedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const mvRef = doc(collection(db, "stock_movements"));
        tx.set(mvRef, {
          movementId: mvRef.id,
          date: displayDate,
          itemCode: formData.sku,
          itemNameSnapshot: prod.itemName,
          type: "ADJUSTMENT",
          referenceId: adjId,
          qtyIn: formData.type === "INCREASE" ? formData.qty : 0,
          qtyOut: formData.type === "DECREASE" ? formData.qty : 0,
          previousStock: currentStock,
          newStock: newStock,
          reason: `${formData.type}: ${formData.reason.trim()}`,
          user: currentUser.name,
          timestamp: serverTimestamp(),
        });
      });

      setIsAdjModalOpen(false);
      showAlert(`Penyesuaian stok [${adjId}] berhasil disimpan!`, "Sukses");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal melakukan penyesuaian stok");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmInitSop(mode: "GENERAL" | "PARTIAL", partialList: any[], sopNotes: string) {
    try {
      setLoading(true);
      const activeCheck = stockOpnames.find((s) => ["OPEN", "COUNTING", "COUNTING_COMPLETED", "ADJUSTMENT"].includes(s.status));
      if (activeCheck) {
        setLoading(false);
        return showAlert(`Masih ada Stock Opname aktif (${activeCheck.documentNo || activeCheck.sopId}).`);
      }

      const targetItems = mode === "GENERAL"
        ? products.filter((p) => p.active === true && p.sku)
        : partialList;

      if (targetItems.length === 0) {
        setLoading(false);
        return showAlert("Tidak ada produk yang dipilih untuk Stock Opname!");
      }

      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];

      const snapshotItems = targetItems.map((p) => ({
        skuId: p.sku,
        skuCode: p.sku,
        itemName: p.itemName,
        systemQtySnapshot: Number(p.stock || 0),
        physicalQty: null,
        isCounted: false,
        countedBy: "",
        countedAt: null,
        adjustmentQty: 0,
        adjustmentReason: "",
      }));

      const counterRef = doc(db, "counters", `sop_counter_${dateStr}`);
      const docNo = await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(counterRef);
        const curr = cSnap.exists() ? (cSnap.data().current || 0) : 0;
        const next = curr + 1;
        const sopId = `SOP-${dateStr}-${String(next).padStart(3, "0")}`;

        tx.set(counterRef, { current: next, date: dateStr, updatedAt: serverTimestamp() });
        tx.set(doc(db, "stock_opnames", sopId), {
          sopId: sopId,
          documentNo: sopId,
          opnameDate: displayDate,
          status: "OPEN",
          opnameType: mode,
          initializedBy: currentUser.name,
          initializedAt: serverTimestamp(),
          totalSku: snapshotItems.length,
          items: snapshotItems,
          notes: sopNotes.trim() || `Inisialisasi SOP ${mode}`,
          postingId: "",
          postedBy: "",
          postedAt: null,
        });

        const aRef = doc(collection(db, "audit_trails"));
        tx.set(aRef, {
          auditId: aRef.id,
          userId: currentUser.name,
          role: currentUser.role,
          action: "INITIALIZE_STOCK_OPNAME",
          documentId: sopId,
          documentNo: sopId,
          reason: `Inisialisasi SOP (${mode}) dengan snapshot ${snapshotItems.length} SKU`,
          timestamp: serverTimestamp(),
        });
        return sopId;
      });

      setIsInitSopModalOpen(false);
      showAlert(`Stock Opname (${mode}) berhasil diinisialisasi: [${docNo}].`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal inisialisasi Stock Opname");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSalesOrder(payload: any) {
    const { editingSoId, selectedCustomer, soItems, shippingRates, shippingCost, courierCode, serviceName } = payload;
    try {
      setLoading(true);
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const displayDate = today.toISOString().split("T")[0];

      const subtotal = soItems.reduce((acc: number, it: any) => acc + it.subtotal, 0);
      const totalWeight = soItems.reduce((acc: number, it: any) => acc + (it.weightInGrams || 0) * it.qty, 0);
      const grandTotal = subtotal + shippingCost;
      const addr = selectedCustomer.displayAddress || selectedCustomer.fullAddress || "-";

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
          updatedBy: currentUser.name,
        });
        showAlert(`Sales Order [${editingSoId}] berhasil diperbarui!`);
      } else {
        const counterRef = doc(db, "counters", "sales_order");
        const newSoId = await runTransaction(db, async (tx) => {
          const cSnap = await tx.get(counterRef);
          const curr = cSnap.exists() ? (cSnap.data().currentNumber || 0) : 0;
          const next = curr + 1;
          const generatedSoId = `SO-${dateStr}-${String(next).padStart(5, "0")}`;

          tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() });
          tx.set(doc(db, "sales_orders", generatedSoId), {
            soId: generatedSoId,
            date: displayDate,
            customerId: selectedCustomer.customerId || selectedCustomer.id || "",
            customerName: selectedCustomer.customerName,
            phone: selectedCustomer.phone || "-",
            address: addr,
            expedition: serviceName || "Reguler",
            items: soItems,
            total: grandTotal,
            totalWeightInGrams: totalWeight,
            shippingCost: shippingCost,
            shippingCourier: courierCode,
            shippingServiceName: serviceName,
            shippingRatesSnapshot: shippingRates,
            status: "CONFIRMED",
            cancelReason: "",
            createdBy: currentUser.name,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return generatedSoId;
        });
        showAlert(`Sales Order [${newSoId}] berhasil dibuat (Status: CONFIRMED)!`);
      }

      setIsSoModalOpen(false);
      setEditingSoId(null);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menyimpan Sales Order");
    } finally {
      setLoading(false);
    }
  }

  async function executeMarkProcessing() {
    if (!processingConfirmTarget) return;
    const so = processingConfirmTarget;
    setProcessingConfirmTarget(null);

    try {
      setLoading(true);
      await updateDoc(doc(db, "sales_orders", so.soId || so.id), {
        status: "PROCESSING",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
      });
      showAlert(`Status SO [${so.soId}] berhasil diubah menjadi PROCESSING!`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal mengubah status SO ke Processing");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProcessingExpedition() {
    if (!targetProcessingSo) return;
    try {
      setLoading(true);
      const subtotalOnly = (targetProcessingSo.items || []).reduce((acc: number, it: any) => acc + (it.subtotal || 0), 0);
      const newTotal = subtotalOnly + (targetProcessingSo.shippingCost || 0);

      await updateDoc(doc(db, "sales_orders", targetProcessingSo.soId || targetProcessingSo.id), {
        shippingCost: targetProcessingSo.shippingCost || 0,
        shippingCourier: targetProcessingSo.shippingCourier || "",
        shippingServiceName: targetProcessingSo.shippingServiceName || "",
        expedition: targetProcessingSo.shippingServiceName || "",
        total: newTotal,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
      });

      showAlert(`Jasa ekspedisi untuk SO [${targetProcessingSo.soId}] berhasil diubah!`);
      setIsEditExpeditionModalOpen(false);
      setTargetProcessingSo(null);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal mengubah ekspedisi");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkReadyToDeliver(so: any) {
    if (so.status !== "PROCESSING") return showAlert("Hanya SO berstatus PROCESSING yang bisa diubah ke READY TO DELIVER!");
    try {
      setLoading(true);
      await updateDoc(doc(db, "sales_orders", so.soId || so.id), {
        status: "READY TO DELIVER",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
      });
      showAlert(`SO [${so.soId}] berstatus READY TO DELIVER! Siap diterbitkan DO.`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal mengubah status ke Ready to Deliver");
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessDO(so: any) {
    if (so.status !== "READY TO DELIVER") return showAlert("Hanya SO berstatus READY TO DELIVER yang bisa diproses ke DO!");
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
          if (liveStock < it.qty) {
            throw new Error(`Stok produk ${it.itemName} (${it.sku}) tidak cukup! Sisa: ${liveStock}, Butuh: ${it.qty}`);
          }
        }

        tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() });
        for (const it of so.items || []) {
          const pRef = doc(db, "products", it.sku);
          const pSnap = await tx.get(pRef);
          const oldStock = pSnap.data().stock || 0;
          const newStock = oldStock - it.qty;

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
            qtyOut: it.qty,
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
          expedition: so.expedition || "-",
          senderName: storeSettings.storeName,
          senderPhone: storeSettings.storePhone,
          senderAddress: storeSettings.storeAddress,
          recipientName: so.customerName || "-",
          recipientPhone: so.phone || "-",
          recipientAddress: so.address || "-",
          totalItems: (so.items || []).length,
          totalPcs: (so.items || []).reduce((acc: number, it: any) => acc + (it.qty || 1), 0),
          totalWeightInGrams: so.totalWeightInGrams || 0,
          shippingCost: so.shippingCost || 0,
          shippingCourier: so.shippingCourier || "",
          shippingServiceName: so.shippingServiceName || "",
          items: so.items || [],
          isStockDeducted: true,
          createdBy: currentUser.name,
          createdAt: serverTimestamp(),
        });
        return generatedDoId;
      });

      showAlert(`Delivery Order [${doId}] berhasil diterbitkan dan stok fisik terpotong!`);
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal memproses Delivery Order.");
    } finally {
      setLoading(false);
    }
  }

  // Create PO Handler
  async function handleCreatePurchaseOrder(payload: any) {
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
        const poId = `PO-${dateStr}-${String(next).padStart(5, "0")}`;

        tx.set(counterRef, { currentNumber: next, updatedAt: serverTimestamp() });
        tx.set(doc(db, "purchase_orders", poId), {
          poId: poId,
          documentNo: poId,
          poDate: displayDate,
          supplier: payload.supplier.trim(),
          supplierAddress: payload.address.trim(),
          supplierPhone: payload.phone.trim(),
          notes: payload.notes.trim(),
          status: "OPEN",
          items: payload.items.map((it: any) => ({
            sku: it.sku,
            itemName: it.itemName,
            qty: Number(it.qty),
            purchasingPrice: Number(it.purchasingPrice),
            subtotal: Number(it.subtotal),
            receivedQty: 0,
            weightInGrams: Number(it.weightInGrams || 0),
          })),
          total: payload.items.reduce((acc: number, it: any) => acc + Number(it.subtotal), 0),
          createdBy: currentUser.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return poId;
      });

      setIsCreatePoModalOpen(false);
      showAlert(`Purchase Order [${generatedPoId}] berhasil diterbitkan dengan status OPEN!`, "Sukses");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal menerbitkan Purchase Order.");
    } finally {
      setLoading(false);
    }
  }

  // Receiving Handler (PO COMPLETED jika kurang/pas)
  async function handleExecuteReceiving(payload: { po: any; receivedMap: Record<string, number>; notes: string }) {
    try {
      setLoading(true);
      const { po, receivedMap, notes } = payload;
      const today = new Date();
      const displayDate = today.toISOString().split("T")[0];
      const rcvRef = doc(collection(db, "receivings"));

      await runTransaction(db, async (tx) => {
        const poRef = doc(db, "purchase_orders", po.poId || po.id);
        const poSnap = await tx.get(poRef);
        if (!poSnap.exists()) throw new Error("Dokumen PO tidak ditemukan!");
        const currentPo = poSnap.data();

        const receivedList: any[] = [];
        const updatedPoItems = (currentPo.items || []).map((it: any) => {
          const qtyIn = Number(receivedMap[it.sku] || 0);
          if (qtyIn > 0) {
            receivedList.push({
              sku: it.sku,
              itemName: it.itemName,
              qtyReceived: qtyIn,
              purchasingPrice: it.purchasingPrice || 0,
            });

            const pRef = doc(db, "products", it.sku);
            const liveProd = products.find((p) => p.sku === it.sku);
            const currentStock = Number(liveProd?.stock || 0);
            const newStock = currentStock + qtyIn;

            tx.update(pRef, {
              stock: newStock,
              lastReceiving: displayDate,
              updatedAt: serverTimestamp(),
              updatedBy: currentUser.name,
            });

            const mvRef = doc(collection(db, "stock_movements"));
            tx.set(mvRef, {
              movementId: mvRef.id,
              date: displayDate,
              itemCode: it.sku,
              itemNameSnapshot: it.itemName,
              type: "RECEIVING",
              referenceId: po.poId,
              qtyIn: qtyIn,
              qtyOut: 0,
              previousStock: currentStock,
              newStock: newStock,
              reason: `Penerimaan Barang PO ${po.poId}`,
              user: currentUser.name,
              timestamp: serverTimestamp(),
            });

            return { ...it, receivedQty: (it.receivedQty || 0) + qtyIn };
          }
          return it;
        });

        // PO dinyatakan COMPLETED
        tx.update(poRef, {
          items: updatedPoItems,
          status: "COMPLETED",
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.name,
        });

        tx.set(rcvRef, {
          receivingId: rcvRef.id,
          poId: po.poId,
          date: displayDate,
          supplier: po.supplier || "-",
          items: receivedList,
          notes: notes.trim(),
          createdBy: currentUser.name,
          createdAt: serverTimestamp(),
        });
      });

      setIsReceivingModalOpen(false);
      setSelectedPoForReceiving(null);
      showAlert(`Barang berhasil diterima dan Purchase Order [${payload.po.poId}] dinyatakan SELESAI (COMPLETED)!`, "Sukses");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal memproses penerimaan barang.");
    } finally {
      setLoading(false);
    }
  }

  async function executeCancelSop() {
    if (!sopCancelTarget) return;
    if (!sopCancelReason.trim()) return showAlert("Alasan pembatalan Stock Opname wajib diisi!");
    setIsSopCancelConfirmOpen(false);

    try {
      setLoading(true);
      const sopDocId = sopCancelTarget.documentNo || sopCancelTarget.sopId || sopCancelTarget.id;
      await runTransaction(db, async (tx) => {
        tx.update(doc(db, "stock_opnames", sopDocId), {
          status: "CANCELLED",
          cancelReason: sopCancelReason.trim(),
          cancelledBy: currentUser.name,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const aRef = doc(collection(db, "audit_trails"));
        tx.set(aRef, {
          auditId: aRef.id,
          userId: currentUser.name,
          role: currentUser.role,
          action: "CANCEL_STOCK_OPNAME",
          documentId: sopDocId,
          documentNo: sopDocId,
          reason: `Stock Opname dibatalkan: ${sopCancelReason.trim()}`,
          timestamp: serverTimestamp(),
        });
      });
      showAlert(`Stock Opname [${sopDocId}] berhasil dibatalkan.`);
      setSopCancelTarget(null);
      setSopCancelReason("");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal membatalkan Stock Opname");
    } finally {
      setLoading(false);
    }
  }

  async function executeCancelPo() {
    if (!poCancelTarget) return;
    if (!poCancelReason.trim()) return showAlert("Alasan pembatalan PO wajib diisi!");
    setIsPoCancelConfirmOpen(false);

    try {
      setLoading(true);
      const poDocId = poCancelTarget.poId || poCancelTarget.id;
      await updateDoc(doc(db, "purchase_orders", poDocId), {
        status: "CANCELLED",
        cancelReason: poCancelReason.trim(),
        cancelledBy: currentUser.name,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showAlert(`Purchase Order [${poDocId}] berhasil dibatalkan.`);
      setPoCancelTarget(null);
      setPoCancelReason("");
      loadAllData();
    } catch (err: any) {
      showAlert(err.message || "Gagal membatalkan PO");
    } finally {
      setLoading(false);
    }
  }

  const displayedSalesOrders = useMemo(() => {
    if (soStatusFilter === "ALL") return salesOrders;
    return salesOrders.filter((s) => s.status === soStatusFilter);
  }, [salesOrders, soStatusFilter]);

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

  return (
    <div className="flex h-screen bg-[#FFF5F6] font-sans text-rose-950">
      {/* SIDEBAR */}
      <aside className="w-72 bg-[#4A2033] text-rose-100 flex flex-col shadow-2xl border-r border-[#6E354F]">
        <div className="p-5 border-b border-[#6E354F]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧥</span>
            <h1 className="text-base font-bold text-white tracking-wide">WMS Atin&apos;s Coll</h1>
          </div>
          <p className="text-[11px] text-rose-300 mt-0.5">Warehouse Management System</p>
          <div className="mt-3 px-3 py-1.5 bg-[#5C2B42] rounded-lg text-xs flex justify-between items-center text-rose-200">
            <span>Login: <b className="text-white">{currentUser.name}</b></span>
            {isRootAdmin && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold uppercase">Root</span>}
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
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCurrentTab(item.key as MainTab)}
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
        <header className="bg-white border-b border-rose-100 px-8 py-4 flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-rose-950 uppercase">
              {currentTab === "dashboard" && "Dashboard Operasional"}
              {currentTab === "sales" && "Manajemen Sales Order (SO) & Delivery Order (DO)"}
              {currentTab === "inventory" && "Katalog Persediaan & Stock Card Ledger"}
              {currentTab === "purchase" && "Purchasing Order (PO) & Penerimaan Barang"}
              {currentTab === "reports" && "Pusat Laporan Historis (Read-Only)"}
              {currentTab === "settings" && "Konfigurasi Toko & RajaOngkir API"}
            </h2>
            <p className="text-xs text-rose-500">Database Realtime Firestore Sinkron</p>
          </div>
          <button
            type="button"
            onClick={loadAllData}
            className="px-3.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-medium"
          >
            🔄 Refresh Data
          </button>
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

              {salesSubTab === "so" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-rose-950">Menampilkan {displayedSalesOrders.length} Sales Order</span>
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
                      className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                    >
                      + Buat Sales Order (SO) Baru
                    </button>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">No SO</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Customer & Alamat</th>
                          <th className="p-2.5">Item Barang</th>
                          <th className="p-2.5">Ekspedisi & Ongkir</th>
                          <th className="p-2.5">Total Bayar</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Aksi</th>
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
                              {(so.items || []).map((it: any, i: number) => (
                                <div key={i} className="text-[11px]">
                                  • {it.itemName} ({it.qty}x @{formatRupiah(it.price)})
                                </div>
                              ))}
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
                            <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = buildWhatsAppMessage(so);
                                  const cleanPhone = String(so.phone || "").replace(/[^0-9]/g, "");
                                  let targetUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                                  if (cleanPhone) {
                                    const formattedPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
                                    targetUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`;
                                  }
                                  window.open(targetUrl, "_blank");
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                              >
                                💬 WA
                              </button>

                              {so.status === "CONFIRMED" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSoId(so.soId || so.id);
                                      setSoModalInitCustomer({
                                        customerName: so.customerName,
                                        phone: so.phone,
                                        displayAddress: so.address,
                                      });
                                      setSoModalInitItems(so.items || []);
                                      setSoModalInitRates(so.shippingRatesSnapshot || []);
                                      setSoModalInitCost(so.shippingCost || 0);
                                      setSoModalInitCourier(so.shippingCourier || "");
                                      setSoModalInitService(so.shippingServiceName || "");
                                      setIsSoModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setProcessingConfirmTarget(so)}
                                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold"
                                  >
                                    ⏩ Processing
                                  </button>
                                </>
                              )}

                              {so.status === "PROCESSING" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTargetProcessingSo(so);
                                      setIsEditExpeditionModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded text-[11px] font-bold"
                                  >
                                    🚚 Ganti Ekspedisi
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMarkReadyToDeliver(so)}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold"
                                  >
                                    📦 Ready
                                  </button>
                                </>
                              )}

                              {so.status === "READY TO DELIVER" && (
                                <button
                                  type="button"
                                  onClick={() => handleProcessDO(so)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                                >
                                  🚀 Terbitkan DO
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

              {salesSubTab === "do" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <span className="text-xs font-bold text-rose-950">Daftar Delivery Order (Stok Telah Dipotong)</span>
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
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Master Produk & Stok Gudang</span>
                      <p className="text-[11px] text-slate-500">Klik tombol Edit untuk memperbarui parameter produk</p>
                    </div>
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
                        className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                      >
                        + Tambah Produk Baru
                      </button>
                    )}
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
                        {products
                          .filter((p) => {
                            if (!search.trim()) return true;
                            const q = search.toLowerCase();
                            return (
                              (p.sku || "").toLowerCase().includes(q) ||
                              (p.itemName || "").toLowerCase().includes(q) ||
                              (p.familyCode || "").toLowerCase().includes(q)
                            );
                          })
                          .map((p) => (
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
                      <p className="text-[11px] text-slate-500">Koreksi saldo fisik bertambah atau berkurang secara atomik</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdjModalOpen(true)}
                      className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                    >
                      + Buat Penyesuaian Stok
                    </button>
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
                          <th className="p-2.5">Petugas</th>
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
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                adj.adjustmentType === "INCREASE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}>
                                {adj.adjustmentType}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold">
                              {adj.adjustmentType === "INCREASE" ? `+${adj.adjustmentQty}` : `-${adj.adjustmentQty}`}
                            </td>
                            <td className="p-2.5 text-slate-500">{adj.currentStock ?? "-"}</td>
                            <td className="p-2.5 font-bold text-rose-950">{adj.newStock ?? "-"}</td>
                            <td className="p-2.5 max-w-xs truncate" title={adj.reason}>{adj.reason || "-"}</td>
                            <td className="p-2.5">{adj.user || adj.executedBy || "-"}</td>
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
                      <p className="text-[11px] text-slate-500">Pilih mode audit General atau Parsial</p>
                    </div>
                    {isRootAdmin && (
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
                        <th className="p-2.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                      {stockOpnames.map((sop) => (
                        <tr key={sop.id}>
                          <td className="p-2.5 font-mono font-bold">{sop.documentNo || sop.sopId}</td>
                          <td className="p-2.5">{sop.opnameDate}</td>
                          <td className="p-2.5 font-bold">{sop.totalSku} SKU</td>
                          <td className="p-2.5 font-bold text-amber-600">{sop.status}</td>
                          <td className="p-2.5 text-right">
                            {(sop.status === "OPEN" || sop.status === "COUNTING") && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSopCancelTarget(sop);
                                  setSopCancelReason("");
                                  setSopCountdown(10);
                                  setIsSopCancelConfirmOpen(true);
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
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
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Histori Mutasi Stok (stock_movements)</span>
                      <p className="text-[11px] text-slate-500">Catatan kronologis keluar-masuk barang</p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Total: <b>{stockMovements.length}</b></span>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                        <tr>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Nama Barang</th>
                          <th className="p-2.5">Tipe Mutasi</th>
                          <th className="p-2.5">Masuk</th>
                          <th className="p-2.5">Keluar</th>
                          <th className="p-2.5">Stok Awal</th>
                          <th className="p-2.5">Stok Akhir</th>
                          <th className="p-2.5">Referensi</th>
                          <th className="p-2.5">Petugas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {stockMovements.map((m, idx) => (
                          <tr key={m.id || idx} className="hover:bg-rose-50/40 transition">
                            <td className="p-2.5 text-slate-600">{m.date || "-"}</td>
                            <td className="p-2.5 font-mono font-bold text-rose-900">{m.itemCode || "-"}</td>
                            <td className="p-2.5 font-medium">{m.itemNameSnapshot || "-"}</td>
                            <td className="p-2.5 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                m.type === "RECEIVING" ? "bg-emerald-100 text-emerald-800" :
                                m.type === "DELIVERY" ? "bg-blue-100 text-blue-800" :
                                m.type === "ADJUSTMENT" ? "bg-amber-100 text-amber-800" :
                                "bg-purple-100 text-purple-800"
                              }`}>
                                {m.type || "MUTASI"}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold text-emerald-600">{Number(m.qtyIn || 0) > 0 ? `+${m.qtyIn}` : "-"}</td>
                            <td className="p-2.5 font-bold text-red-600">{Number(m.qtyOut || 0) > 0 ? `-${m.qtyOut}` : "-"}</td>
                            <td className="p-2.5 text-slate-600">{m.previousStock ?? "-"}</td>
                            <td className="p-2.5 font-bold text-rose-950">{m.newStock ?? "-"}</td>
                            <td className="p-2.5 text-[11px] text-slate-600">{m.referenceId || "-"}</td>
                            <td className="p-2.5">{m.user || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PURCHASE ORDER & SUB-MENU RECEIVING */}
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
                  Sub-Menu Receiving Masuk ({receivings.length})
                </button>
              </div>

              {/* 4.1 DAFTAR PO */}
              {poSubTab === "po_list" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-rose-950 uppercase">Daftar Purchase Order</span>
                      <p className="text-[11px] text-slate-500">Pemesanan barang ke supplier dan penerimaan logistik</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatePoModalOpen(true)}
                      className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow"
                    >
                      + Buat PO Baru
                    </button>
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
                        {purchaseOrders.map((po) => {
                          const isDone = po.status === "COMPLETED" || po.status === "CANCELLED";
                          return (
                            <tr key={po.id} className="hover:bg-rose-50/30 transition">
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
                                {!isDone && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPoForReceiving(po);
                                        setIsReceivingModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs"
                                    >
                                      📥 Proses Receiving
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPoCancelTarget(po);
                                        setPoCancelReason("");
                                        setIsPoCancelConfirmOpen(true);
                                      }}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold shadow-xs"
                                    >
                                      Batal
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

              {/* 4.2 SUB-MENU RECEIVING MASUK */}
              {poSubTab === "receiving_list" && (
                <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-xs space-y-4">
                  <div>
                    <span className="text-xs font-bold text-rose-950 uppercase">Riwayat Penerimaan Barang (Receivings)</span>
                    <p className="text-[11px] text-slate-500">Log bukti penerimaan barang masuk ke gudang dari supplier</p>
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
                          <th className="p-2.5">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {receivings.map((r) => (
                          <tr key={r.id} className="hover:bg-rose-50/30 transition">
                            <td className="p-2.5 font-mono font-bold text-rose-900">{r.receivingId}</td>
                            <td className="p-2.5 font-mono text-blue-700 font-bold">{r.poId}</td>
                            <td className="p-2.5">{r.date}</td>
                            <td className="p-2.5 font-medium">{r.supplier || "-"}</td>
                            <td className="p-2.5">
                              {(r.items || []).map((it: any, i: number) => (
                                <div key={i} className="text-[11px]">
                                  • {it.itemName}: <b>{it.qtyReceived} pcs</b>
                                </div>
                              ))}
                            </td>
                            <td className="p-2.5">{r.createdBy}</td>
                            <td className="p-2.5 text-slate-500">{r.notes || "-"}</td>
                          </tr>
                        ))}
                        {receivings.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-5 text-center text-slate-400">
                              Belum ada catatan penerimaan barang masuk.
                            </td>
                          </tr>
                        )}
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
                <span className="text-xs font-bold text-rose-950 uppercase">Data Historis Laporan</span>

                <div className="overflow-x-auto text-xs">
                  {reportSubTab === "so" && (
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold">
                        <tr><th className="p-2">No SO</th><th className="p-2">Tanggal</th><th className="p-2">Customer</th><th className="p-2">Total Nilai</th><th className="p-2">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {salesOrders.map((so) => (
                          <tr key={so.id}><td className="p-2 font-mono font-bold">{so.soId}</td><td className="p-2">{so.date}</td><td className="p-2">{so.customerName}</td><td className="p-2 font-bold text-emerald-600">{formatRupiah(Number(so.total || 0))}</td><td className="p-2 font-bold">{so.status}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportSubTab === "do" && (
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold">
                        <tr><th className="p-2">No DO</th><th className="p-2">Ref SO</th><th className="p-2">Tanggal</th><th className="p-2">Penerima</th><th className="p-2">Total Pcs</th><th className="p-2">Ekspedisi</th></tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {deliveryOrders.map((d) => (
                          <tr key={d.id}><td className="p-2 font-mono font-bold">{d.doId}</td><td className="p-2 font-mono">{d.soId}</td><td className="p-2">{d.date}</td><td className="p-2">{d.recipientName}</td><td className="p-2 font-bold">{d.totalPcs} pcs</td><td className="p-2">{d.expedition}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportSubTab === "po" && (
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold">
                        <tr><th className="p-2">No PO</th><th className="p-2">Tanggal</th><th className="p-2">Supplier</th><th className="p-2">Total Nilai</th><th className="p-2">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {purchaseOrders.map((po) => (
                          <tr key={po.id}><td className="p-2 font-mono font-bold">{po.poId}</td><td className="p-2">{po.poDate}</td><td className="p-2">{po.supplier}</td><td className="p-2 font-bold">{formatRupiah(Number(po.total || 0))}</td><td className="p-2 font-bold text-blue-600">{po.status}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportSubTab === "receiving" && (
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold">
                        <tr><th className="p-2">No Receiving</th><th className="p-2">Ref PO</th><th className="p-2">Tanggal</th><th className="p-2">Petugas</th><th className="p-2.5">Catatan</th></tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {receivings.map((r) => (
                          <tr key={r.id}><td className="p-2 font-mono font-bold">{r.receivingId}</td><td className="p-2 font-mono">{r.poId}</td><td className="p-2">{r.date}</td><td className="p-2">{r.createdBy}</td><td className="p-2">{r.notes || "-"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportSubTab === "opname" && (
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-900 font-bold">
                        <tr><th className="p-2">No Dokumen</th><th className="p-2">Tanggal</th><th className="p-2">Total SKU</th><th className="p-2">Status</th><th className="p-2">Petugas Inisiator</th></tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50">
                        {stockOpnames.map((sop) => (
                          <tr key={sop.id}><td className="p-2 font-mono font-bold">{sop.documentNo || sop.sopId}</td><td className="p-2">{sop.opnameDate}</td><td className="p-2 font-bold">{sop.totalSku} SKU</td><td className="p-2 font-bold">{sop.status}</td><td className="p-2">{sop.initializedBy}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {reportSubTab === "stock" && (
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
                  )}

                  {reportSubTab === "sales" && (
                    <div className="space-y-3">
                      <div className="flex gap-2 items-center mb-2">
                        <span>Filter:</span>
                        <select value={salesReportType} onChange={(e) => setSalesReportType(e.target.value as any)} className="p-1 border rounded text-xs bg-white">
                          <option value="summary">Summary Per DO</option>
                          <option value="day">By Day</option>
                          <option value="item">By Item Terjual</option>
                        </select>
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 text-rose-900 font-bold">
                          <tr><th className="p-2">No DO / Tanggal</th><th className="p-2">Penerima / SKU</th><th className="p-2">Total Pcs</th><th className="p-2">Total Nilai</th></tr>
                        </thead>
                        <tbody className="divide-y divide-rose-50">
                          {deliveryOrders.map((d) => (
                            <tr key={d.id}><td className="p-2 font-mono font-bold">{d.doId} ({d.date})</td><td className="p-2">{d.recipientName}</td><td className="p-2 font-bold">{d.totalPcs} pcs</td><td className="p-2 font-bold text-emerald-600">{formatRupiah((d.items || []).reduce((acc: number, it: any) => acc + (it.subtotal || 0), 0))}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {currentTab === "settings" && (
            <div className="max-w-3xl bg-white rounded-2xl border border-rose-100 p-6 shadow-sm space-y-6">
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

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold block mb-1">Kode Pos</label>
                      <input
                        type="text"
                        placeholder="40377"
                        value={storeSettings.postalCode}
                        onChange={(e) => setStoreSettings({ ...storeSettings, postalCode: e.target.value })}
                        className="w-full p-2 border border-rose-200 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Ukuran Kertas Thermal Struk</label>
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
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-rose-950 uppercase">Pengaturan API Key RajaOngkir (Komerce v1)</h3>
                  <p className="text-xs text-rose-500">Uji koneksi terlebih dahulu. Tombol simpan hanya aktif jika API berhasil bekerja.</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold block mb-1 text-slate-700">Input RajaOngkir API Key Baru</label>
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
                      className="px-5 py-2.5 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow transition"
                    >
                      {isSavingApiKey ? "Menyimpan..." : "Konfirmasi & Simpan API Key"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* POP-UP MODAL KONFIRMASI UJI API KEY */}
      {isApiSuccessModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-emerald-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
              ✓
            </div>
            <h3 className="text-base font-bold text-emerald-950 mb-1">API Key Terverifikasi!</h3>
            <p className="text-xs text-emerald-800 mb-6 leading-relaxed">
              Koneksi ke RajaOngkir Komerce berhasil dan API Key dapat bekerja dengan baik. Tekan tombol OK untuk mengaktifkan tombol konfirmasi penyimpanan.
            </p>
            <button
              type="button"
              onClick={() => {
                setApiKeyTestedSuccess(true);
                setIsApiSuccessModalOpen(false);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* MODAL MODULAR */}
      <ProductModal
        isOpen={isProductModalOpen}
        isEditing={isEditingProduct}
        families={families}
        initialData={productFormData}
        onClose={() => setIsProductModalOpen(false)}
        onConfirmSave={handleSaveProduct}
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
        onConfirmInit={handleConfirmInitSop}
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
        onSaveSo={handleSaveSalesOrder}
        showAlert={showAlert}
      />

      <CreatePurchaseOrderModal
        isOpen={isCreatePoModalOpen}
        products={products}
        onClose={() => setIsCreatePoModalOpen(false)}
        onSubmitPo={handleCreatePurchaseOrder}
        showAlert={showAlert}
      />

      <ReceivingModal
        isOpen={isReceivingModalOpen}
        selectedPo={selectedPoForReceiving}
        onClose={() => {
          setIsReceivingModalOpen(false);
          setSelectedPoForReceiving(null);
        }}
        onExecuteReceiving={handleExecuteReceiving}
        showAlert={showAlert}
      />

      {/* MODAL GANTI EKSPEDISI DARI SNAPSHOT (SO PROCESSING) */}
      {isEditExpeditionModalOpen && targetProcessingSo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-rose-100">
            <h3 className="text-base font-bold text-rose-950 mb-1">Ganti Ekspedisi (SO Processing)</h3>
            <p className="text-xs text-rose-600 font-mono mb-4">SO: {targetProcessingSo.soId} | Pilihan dari snapshot pembuatan SO</p>

            <div className="space-y-2 mb-4">
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
                  className={`p-3 rounded-lg border text-xs cursor-pointer flex justify-between items-center ${
                    targetProcessingSo.shippingServiceName === r.serviceName ? "bg-[#BE185D] text-white font-bold" : "bg-white border-rose-200"
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

            <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
              <button type="button" onClick={() => setIsEditExpeditionModalOpen(false)} className="px-3 py-1.5 bg-slate-100 rounded text-xs font-bold">Tutup</button>
              <button type="button" onClick={handleSaveProcessingExpedition} className="px-4 py-1.5 bg-[#BE185D] text-white rounded text-xs font-bold">Simpan Ekspedisi</button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP KONFIRMASI STATUS PROCESSING */}
      {processingConfirmTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-purple-200 text-center">
            <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
              ⏩
            </div>
            <h3 className="text-base font-bold text-rose-950 mb-1">Konfirmasi Status Processing</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menaikkan status SO <b>{processingConfirmTarget.soId}</b> ke <b>PROCESSING</b>? Setelah status dinaikkan, daftar barang dan harga akan dikunci.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProcessingConfirmTarget(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeMarkProcessing}
                className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow"
              >
                Ya, Ubah Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KARTU MUTASI DETAIL PER SKU */}
      {selectedProductLedger && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-rose-100 flex flex-col max-h-[85vh]">
            <div className="border-b border-rose-100 pb-3 mb-3">
              <h3 className="text-base font-bold text-rose-950">Kartu Stok: {selectedProductLedger.itemName}</h3>
              <p className="text-xs font-mono font-bold text-rose-600">SKU: {selectedProductLedger.sku} | Saldo Fisik: {selectedProductLedger.stock || 0} pcs</p>
            </div>
            <div className="overflow-y-auto flex-1 text-xs">
              <table className="w-full text-left">
                <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                  <tr>
                    <th className="p-2">Tanggal</th>
                    <th className="p-2">Tipe</th>
                    <th className="p-2">Masuk</th>
                    <th className="p-2">Keluar</th>
                    <th className="p-2">Saldo Akhir</th>
                    <th className="p-2">Ref / Alasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {selectedProductMovements.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2">{m.date}</td>
                      <td className="p-2 font-bold">{m.type}</td>
                      <td className="p-2 text-emerald-600 font-bold">{m.qtyIn > 0 ? `+${m.qtyIn}` : "-"}</td>
                      <td className="p-2 text-red-600 font-bold">{m.qtyOut > 0 ? `-${m.qtyOut}` : "-"}</td>
                      <td className="p-2 font-bold">{m.newStock}</td>
                      <td className="p-2 text-[11px] text-slate-500">{m.reason || m.referenceId}</td>
                    </tr>
                  ))}
                  {selectedProductMovements.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-400">Belum ada pergerakan stok untuk SKU ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pt-3 border-t border-rose-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProductLedger(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCEL SOP */}
      {isSopCancelConfirmOpen && sopCancelTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-200">
            <h3 className="text-base font-bold text-red-950 mb-1">Batalkan Stock Opname</h3>
            <p className="text-xs text-red-600 font-mono font-bold mb-3">Dokumen: {sopCancelTarget.documentNo || sopCancelTarget.sopId}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Pembatalan (Wajib)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ketik alasan pembatalan..."
                  value={sopCancelReason}
                  onChange={(e) => setSopCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-rose-200 rounded-lg text-xs outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsSopCancelConfirmOpen(false)} className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold">Tutup</button>
                <button
                  type="button"
                  disabled={sopCountdown > 0}
                  onClick={executeCancelSop}
                  className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition ${sopCountdown > 0 ? "bg-slate-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {sopCountdown > 0 ? `Konfirmasi Batal (${sopCountdown}s)` : "Konfirmasi Batal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCEL PO */}
      {isPoCancelConfirmOpen && poCancelTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-200">
            <h3 className="text-base font-bold text-red-950 mb-1">Batalkan Purchase Order</h3>
            <p className="text-xs text-red-600 font-mono font-bold mb-3">No PO: {poCancelTarget.poId}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Pembatalan (Wajib)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ketik alasan pembatalan PO..."
                  value={poCancelReason}
                  onChange={(e) => setPoCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-rose-200 rounded-lg text-xs outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsPoCancelConfirmOpen(false)} className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold">Tutup</button>
                <button type="button" onClick={executeCancelPo} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">Konfirmasi Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI LOGOUT */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-100 text-center">
            <div className="w-12 h-12 bg-rose-100 text-[#9F1239] rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
              🚪
            </div>
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
                onClick={handleExecuteLogout}
                className="flex-1 py-2 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-bold rounded-xl shadow"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT POP-UP UMUM */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-100 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-2">{alertModal.title}</h3>
            <p className="text-xs text-rose-700 mb-5">{alertModal.message}</p>
            <button
              type="button"
              onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })}
              className="w-full py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}