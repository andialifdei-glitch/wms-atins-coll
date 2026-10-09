"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type MenuKey =
  | "stock_report"
  | "stock_movement"
  | "receiving_report"
  | "po_aktif"
  | "sales_by_day"
  | "sales_summary"
  | "customers_report"
  | "users_report"
  | "assortment"
  | "user_management";

interface NavGroup {
  group: string;
  items: { key: MenuKey; label: string; desc: string }[];
}

const MENU_GROUPS: NavGroup[] = [
  {
    group: "Stock",
    items: [
      { key: "stock_report", label: "Stock Report", desc: "Katalog & Saldo Produk (products)" },
      { key: "stock_movement", label: "Stock Movement", desc: "Mutasi DO & SOP Posting" },
      { key: "receiving_report", label: "Receiving Report", desc: "Penerimaan Barang (receivings)" },
      { key: "po_aktif", label: "PO Aktif", desc: "Purchase Orders aktif (purchase_orders)" },
    ],
  },
  {
    group: "Sales",
    items: [
      { key: "sales_by_day", label: "Sales by Day", desc: "Ringkasan Penjualan Harian" },
      { key: "sales_summary", label: "Sales Summary by Item", desc: "Total Penjualan per Barang" },
    ],
  },
  {
    group: "Human",
    items: [
      { key: "customers_report", label: "Report Customers", desc: "Data Pelanggan (customers)" },
      { key: "users_report", label: "Report Users", desc: "Audit Pengguna & Petugas (audit_trails)" },
    ],
  },
  {
    group: "Katalog & Master",
    items: [
      { key: "assortment", label: "Assortment", desc: "Kelola Parameter & Tambah Produk" },
    ],
  },
  {
    group: "Pengaturan",
    items: [
      { key: "user_management", label: "User Management", desc: "Kelola Akun Akses Portal" },
    ],
  },
];

interface FamilyItem {
  id: string;
  familyCode: string;
  familyName?: string;
}

export default function AdminReportPortal() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("stock_report");
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    Stock: true,
    Sales: true,
    Human: false,
    "Katalog & Master": true,
    Pengaturan: true,
  });
  const [rawData, setRawData] = useState<any[]>([]);
  const [familiesList, setFamiliesList] = useState<FamilyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name: string; username?: string }>({
    id: "admin",
    role: "Root Admin",
    name: "Root Admin (Atin's Collection)",
    username: "admin",
  });

  const [alertInfo, setAlertInfo] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: "",
  });
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const [isSecurityConfirmOpen, setIsSecurityConfirmOpen] = useState(false);
  const [countdown, setCountdown] = useState(10);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    sku: "",
    itemName: "",
    familyCode: "",
    weightInGrams: 0,
    productActive: true,
    purchasingPrice: 0,
    netPrice: 0,
    initialStock: 0,
  });

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: "",
    fullName: "",
    password: "",
    role: "Staff",
  });

  const [deleteTargetUser, setDeleteTargetUser] = useState<{ id: string; username: string } | null>(null);

  const router = useRouter();

  const isRootAdmin = useMemo(() => {
    const userClean = String(currentUser.username || currentUser.id || "").trim().toLowerCase();
    const roleClean = String(currentUser.role || "").trim().toLowerCase();
    return (
      userClean === "admin" ||
      userClean === "root" ||
      userClean === "rootadmin" ||
      roleClean.includes("root") ||
      roleClean.includes("super")
    );
  }, [currentUser]);

  const showAlert = (message: string, title = "Pemberitahuan") => {
    setAlertInfo({ isOpen: true, title, message });
  };

  const toggleDropdown = (groupName: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  useEffect(() => {
    try {
      const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith("admin_session="));
      if (match) {
        const val = decodeURIComponent(match.split("=")[1]);
        const parsed = JSON.parse(val);
        const resolvedUsername = parsed.username || parsed.id || "admin";
        const isHardcodedAdmin = String(resolvedUsername).trim().toLowerCase() === "admin";

        setCurrentUser({
          id: resolvedUsername,
          role: isHardcodedAdmin ? "Root Admin" : (parsed.role || "Admin"),
          name: parsed.fullName || parsed.name || (isHardcodedAdmin ? "Root Admin (Atin's Collection)" : resolvedUsername),
          username: resolvedUsername,
        });
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    if (!isSecurityConfirmOpen) {
      setCountdown(10);
      return;
    }
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isSecurityConfirmOpen, countdown]);

  async function proceedLogout() {
    setIsLogoutConfirmOpen(false);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const getHeaderTimestamp = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return {
      dateFormatted: `${day}${month}${year}`,
      timeFormatted: `${hours}:${minutes}`,
    };
  };

  const extractDate = (row: any): string | null => {
    const rawVal =
      row.createdAt ||
      row.timestamp ||
      row.date ||
      row.orderDate ||
      row.deliveryDate ||
      row.receivedAt;

    if (!rawVal) return null;
    if (typeof rawVal === "object" && rawVal.seconds) {
      return new Date(rawVal.seconds * 1000).toISOString().split("T")[0];
    }
    if (typeof rawVal === "string") {
      const parsed = Date.parse(rawVal);
      if (!isNaN(parsed)) return new Date(parsed).toISOString().split("T")[0];
    }
    return null;
  };

  const formatItemsList = (items: any): string => {
    if (!items) return "-";
    if (Array.isArray(items)) {
      return items
        .map((it: any, i: number) => {
          const name = it.itemName || it.name || it.sku || `Item ${i + 1}`;
          const qty = it.qty || it.quantity || it.receivedQty || 1;
          const price = it.price ? ` @Rp${Number(it.price).toLocaleString("id-ID")}` : "";
          return `${i + 1}. ${name} (Qty: ${qty}${price})`;
        })
        .join("\n");
    }
    if (typeof items === "object") {
      return Object.entries(items)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join("\n");
    }
    return String(items);
  };

  // Helper untuk mengecek status aktif secara konsisten di semua platform
  const resolveIsProductActive = (r: any): boolean => {
    if (r.productActive !== undefined && r.productActive !== null) {
      return String(r.productActive).toLowerCase() === "true" || r.productActive === true;
    }
    if (r.active !== undefined && r.active !== null) {
      return String(r.active).toLowerCase() === "true" || r.active === true;
    }
    if (r.status !== undefined && r.status !== null) {
      const s = String(r.status).trim().toLowerCase();
      return s === "aktif" || s === "active";
    }
    return true;
  };

  useEffect(() => {
    async function fetchFamilies() {
      try {
        const snap = await getDocs(query(collection(db, "families"), limit(100)));
        const list: FamilyItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            familyCode: data.familyCode || d.id,
            familyName: data.familyName || data.name || d.id,
          };
        });
        setFamiliesList(list);
      } catch (err) {
        console.error("Gagal memuat families:", err);
      }
    }
    fetchFamilies();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (activeMenu === "stock_report" || activeMenu === "assortment") {
        const snap = await getDocs(query(collection(db, "products"), limit(500)));
        setRawData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else if (activeMenu === "stock_movement") {
        const [doSnap, sopSnap] = await Promise.all([
          getDocs(query(collection(db, "delivery_orders"), limit(50))),
          getDocs(query(collection(db, "sop_postings"), limit(50))),
        ]);
        const combined = [
          ...doSnap.docs.map((d) => ({ id: d.id, movement_type: "OUT (Delivery Order)", ...d.data() })),
          ...sopSnap.docs.map((d) => ({ id: d.id, movement_type: "ADJUSTMENT (SOP Posting)", ...d.data() })),
        ];
        setRawData(combined);
      } else if (activeMenu === "receiving_report") {
        const snap = await getDocs(query(collection(db, "receivings"), limit(100)));
        setRawData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else if (activeMenu === "po_aktif") {
        const snap = await getDocs(query(collection(db, "purchase_orders"), limit(100)));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const filtered = list.filter((r: any) =>
          r.status ? !["completed", "cancelled", "done", "selesai"].includes(String(r.status).toLowerCase()) : true
        );
        setRawData(filtered);
      } else if (activeMenu === "sales_by_day" || activeMenu === "sales_summary") {
        const snap = await getDocs(query(collection(db, "delivery_orders"), limit(150)));
        setRawData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else if (activeMenu === "customers_report") {
        const snap = await getDocs(query(collection(db, "customers"), limit(100)));
        setRawData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else if (activeMenu === "users_report") {
        const snap = await getDocs(query(collection(db, "audit_trails"), limit(100)));
        setRawData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else if (activeMenu === "user_management") {
        const snap = await getDocs(query(collection(db, "portal_users"), limit(100)));
        setRawData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      console.error("Gagal mengambil data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeMenu]);

  async function fetchLastSkuForFamily(famCode: string): Promise<string> {
    if (!famCode) return "";
    const cleanFam = famCode.trim();
    let maxSequence = 0;

    try {
      const q = query(collection(db, "products"), where("familyCode", "==", cleanFam));
      const snap = await getDocs(q);

      snap.docs.forEach((d) => {
        const skuStr = String(d.data().sku || "");
        const match = skuStr.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxSequence) maxSequence = num;
        }
      });

      rawData.forEach((item) => {
        if (String(item.familyCode || "").trim().toLowerCase() === cleanFam.toLowerCase()) {
          const skuStr = String(item.sku || "");
          const match = skuStr.match(/\d+$/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (!isNaN(num) && num > maxSequence) maxSequence = num;
          }
        }
      });
    } catch (e) {
      console.error("Error scan sku:", e);
    }

    const nextSeq = maxSequence + 1;
    const padded = String(nextSeq).padStart(4, "0");
    return `SKU-${cleanFam}${padded}`;
  }

  async function handleFamilyChange(selectedFam: string) {
    if (!isEditingProduct) {
      if (!selectedFam) {
        setProductForm((prev) => ({ ...prev, familyCode: "", sku: "" }));
        return;
      }
      setIsGeneratingSku(true);
      const generatedSku = await fetchLastSkuForFamily(selectedFam);
      setProductForm((prev) => ({
        ...prev,
        familyCode: selectedFam,
        sku: generatedSku,
      }));
      setIsGeneratingSku(false);
    } else {
      setProductForm((prev) => ({
        ...prev,
        familyCode: selectedFam,
      }));
    }
  }

  const displayRows = useMemo(() => {
    let rows = [...rawData];

    if (startDate || endDate) {
      rows = rows.filter((r) => {
        const d = extractDate(r);
        if (!d) return true;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }

    if (activeMenu === "sales_by_day") {
      const dayMap = new Map<string, { totalOrders: number; totalQty: number; totalAmount: number }>();
      rows.forEach((row) => {
        const dateKey = extractDate(row) || "Tanpa Tanggal";
        const current = dayMap.get(dateKey) || { totalOrders: 0, totalQty: 0, totalAmount: 0 };
        current.totalOrders += 1;

        let itemsQty = 0;
        let itemsAmt = Number(row.totalAmount || row.grandTotal || row.total || 0);

        if (Array.isArray(row.items)) {
          row.items.forEach((it: any) => {
            itemsQty += Number(it.qty || it.quantity || 1);
            if (!itemsAmt && it.price) itemsAmt += Number(it.price) * Number(it.qty || 1);
          });
        }
        current.totalQty += itemsQty;
        current.totalAmount += itemsAmt;
        dayMap.set(dateKey, current);
      });

      return Array.from(dayMap.entries()).map(([date, val]) => ({
        Tanggal: date,
        "Total Order / DO": val.totalOrders,
        "Total Qty Barang": val.totalQty,
        "Estimasi Nominal (IDR)": val.totalAmount.toLocaleString("id-ID"),
      }));
    }

    if (activeMenu === "sales_summary") {
      const itemMap = new Map<string, { itemName: string; totalQty: number; totalRevenue: number; occurrences: number }>();
      rows.forEach((row) => {
        if (Array.isArray(row.items)) {
          row.items.forEach((it: any) => {
            const key = it.sku || it.productId || it.itemName || "Item Tak Dikenal";
            const name = it.itemName || it.name || key;
            const qty = Number(it.qty || it.quantity || 1);
            const price = Number(it.price || 0);

            const curr = itemMap.get(key) || { itemName: name, totalQty: 0, totalRevenue: 0, occurrences: 0 };
            curr.totalQty += qty;
            curr.totalRevenue += qty * price;
            curr.occurrences += 1;
            itemMap.set(key, curr);
          });
        }
      });

      return Array.from(itemMap.entries()).map(([code, val]) => ({
        "Kode / SKU": code,
        "Nama Produk": val.itemName,
        "Jumlah Transaksi": val.occurrences,
        "Total Qty Terjual": val.totalQty,
        "Total Omset (IDR)": val.totalRevenue.toLocaleString("id-ID"),
      }));
    }

    if (activeMenu === "assortment") {
      return rows.map((r) => {
        const isActive = resolveIsProductActive(r);
        return {
          id: r.id,
          SKU: r.sku || "-",
          "Item Name": r.itemName || "-",
          "Fam Code": r.familyCode || "-",
          "Weight (Grams)": `${r.weightInGrams ?? 0} gr`,
          Status: isActive ? "Aktif" : "Nonaktif",
          "Purchasing Price": r.purchasingPrice ? `Rp${Number(r.purchasingPrice).toLocaleString("id-ID")}` : "-",
          "Net Price": r.netPrice ? `Rp${Number(r.netPrice).toLocaleString("id-ID")}` : "-",
          _raw: r,
        };
      });
    }

    if (activeMenu === "user_management") {
      return rows.map((r) => ({
        Username: r.username || "-",
        "Full Name": r.fullName || "-",
        Role: r.role || "-",
        "Dibuat Pada": r.createdAt && r.createdAt.seconds
          ? new Date(r.createdAt.seconds * 1000).toLocaleString("id-ID")
          : "-",
        _raw: r,
      }));
    }

    if (activeMenu === "receiving_report") {
      return rows.map((r) => {
        const copy = { ...r };
        delete copy.items;
        return copy;
      });
    }

    if (search.trim()) {
      const queryText = search.toLowerCase();
      rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(queryText));
    }

    return rows;
  }, [rawData, activeMenu, search, startDate, endDate]);

  const dynamicColumns = useMemo(() => {
    if (!displayRows.length) return [];
    const keys = new Set<string>();
    displayRows.slice(0, 25).forEach((r) => {
      Object.keys(r).forEach((k) => {
        if (
          k !== "_raw" &&
          k !== "passwordHash" &&
          k !== "password_hash" &&
          (activeMenu !== "user_management" || k !== "id")
        ) {
          keys.add(k);
        }
      });
    });
    const list = Array.from(keys);
    return list.includes("id") ? ["id", ...list.filter((k) => k !== "id")] : list;
  }, [displayRows, activeMenu]);

  const activeLabel = useMemo(() => {
    return MENU_GROUPS.flatMap((g) => g.items).find((i) => i.key === activeMenu)?.label || "Report";
  }, [activeMenu]);

  function exportToExcel() {
    if (!displayRows.length) return showAlert("Tidak ada data untuk diekspor!", "Pemberitahuan");
    const { dateFormatted, timeFormatted } = getHeaderTimestamp();

    const titleBlock = [
      [activeLabel],
      ["WMS by Atin's Collection IT Support"],
      [`Dibuat oleh : ${currentUser.name} tanggal : ${dateFormatted} jam : ${timeFormatted}`],
      [],
    ];

    const cleanData = displayRows.map((row) => {
      const formatted: any = {};
      dynamicColumns.forEach((col) => {
        const val = row[col];
        if (val && typeof val === "object" && val.seconds) {
          formatted[col] = new Date(val.seconds * 1000).toLocaleString("id-ID");
        } else if (val && typeof val === "object") {
          formatted[col] = formatItemsList(val);
        } else {
          formatted[col] = val ?? "-";
        }
      });
      return formatted;
    });

    const worksheet = XLSX.utils.aoa_to_sheet(titleBlock);
    XLSX.utils.sheet_add_json(worksheet, cleanData, { origin: "A5" });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeLabel.slice(0, 31));
    XLSX.writeFile(workbook, `${activeLabel}_${dateFormatted}_${timeFormatted.replace(":", "")}.xlsx`);
  }

  function exportToPDF() {
    if (!displayRows.length) return showAlert("Tidak ada data untuk diekspor!", "Pemberitahuan");
    const { dateFormatted, timeFormatted } = getHeaderTimestamp();
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(14);
    doc.setTextColor(157, 23, 77);
    doc.text(activeLabel, 14, 14);

    doc.setFontSize(10);
    doc.setTextColor(112, 26, 117);
    doc.text("WMS by Atin's Collection IT Support", 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Dibuat oleh : ${currentUser.name} tanggal : ${dateFormatted} jam : ${timeFormatted}`,
      14,
      26
    );

    const head = [dynamicColumns];
    const body = displayRows.map((row) =>
      dynamicColumns.map((col) => {
        const val = row[col];
        if (val && typeof val === "object" && val.seconds) {
          return new Date(val.seconds * 1000).toLocaleString("id-ID");
        }
        if (val && typeof val === "object") return formatItemsList(val);
        return String(val ?? "-");
      })
    );

    autoTable(doc, {
      head,
      body,
      startY: 32,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [190, 24, 93], textColor: 255 },
      alternateRowStyles: { fillColor: [253, 242, 248] },
    });

    doc.save(`${activeLabel}_${dateFormatted}_${timeFormatted.replace(":", "")}.pdf`);
  }

  function handleGenerateSingleReceiving(receivingRow: any) {
    const rawMatch = rawData.find((r) => r.id === receivingRow.id) || receivingRow;
    const { dateFormatted, timeFormatted } = getHeaderTimestamp();
    const doc = new jsPDF({ orientation: "portrait" });

    doc.setFontSize(15);
    doc.setTextColor(157, 23, 77);
    doc.text("Receiving Report Individual", 14, 16);

    doc.setFontSize(10);
    doc.setTextColor(112, 26, 117);
    doc.text("WMS by Atin's Collection IT Support", 14, 22);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Dibuat oleh : ${currentUser.name} tanggal : ${dateFormatted} jam : ${timeFormatted}`,
      14,
      28
    );

    const details = [
      ["Receiving ID", String(rawMatch.id || "-")],
      ["No Dokumen / Ref", String(rawMatch.documentNo || rawMatch.docNo || rawMatch.refNo || "-")],
      ["Supplier / Vendor", String(rawMatch.supplier || rawMatch.vendor || "-")],
      ["Status", String(rawMatch.status || "-")],
      [
        "Tanggal Diterima",
        rawMatch.receivedAt && rawMatch.receivedAt.seconds
          ? new Date(rawMatch.receivedAt.seconds * 1000).toLocaleString("id-ID")
          : String(rawMatch.receivedAt || "-"),
      ],
    ];

    autoTable(doc, {
      startY: 34,
      body: details,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    });

    const itemsRaw = rawMatch.items || [];
    let itemsTableBody: any[] = [];

    if (Array.isArray(itemsRaw)) {
      itemsTableBody = itemsRaw.map((it: any, idx: number) => [
        idx + 1,
        it.sku || it.productId || "-",
        it.itemName || it.name || "-",
        it.qty || it.quantity || it.receivedQty || 0,
        it.unit || "PCS",
      ]);
    } else {
      itemsTableBody = [[1, "-", formatItemsList(itemsRaw), "-", "-"]];
    }

    doc.setFontSize(11);
    doc.setTextColor(157, 23, 77);
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 70;
    doc.text("Daftar Barang Diterima (List Items):", 14, finalY);

    autoTable(doc, {
      startY: finalY + 4,
      head: [["No", "Kode/SKU", "Nama Barang", "Qty Diterima", "Satuan"]],
      body: itemsTableBody,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [190, 24, 93], textColor: 255 },
      alternateRowStyles: { fillColor: [253, 242, 248] },
    });

    doc.save(`Receiving_${rawMatch.id || "Report"}_${dateFormatted}.pdf`);
  }

  function handleProductFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEditingProduct) {
      setCountdown(10);
      setIsSecurityConfirmOpen(true);
    } else {
      executeSaveProduct();
    }
  }

  async function executeSaveProduct() {
    setIsSecurityConfirmOpen(false);
    try {
      // Sinkronkan seluruh format status legacy & modern agar konsisten di Firestore
      const isActiveBool = Boolean(productForm.productActive);
      const statusText = isActiveBool ? "Aktif" : "Nonaktif";

      if (isEditingProduct && editingProductId) {
        const payload = {
          sku: productForm.sku,
          itemName: productForm.itemName,
          familyCode: productForm.familyCode,
          weightInGrams: Number(productForm.weightInGrams),
          productActive: isActiveBool,
          active: isActiveBool,
          status: statusText,
          purchasingPrice: Number(productForm.purchasingPrice),
          netPrice: Number(productForm.netPrice),
          updatedAt: serverTimestamp(),
        };
        await updateDoc(doc(db, "products", editingProductId), payload);
        showAlert(`Parameter & status produk berhasil diperbarui menjadi ${statusText}!`, "Sukses");
      } else {
        if (!isRootAdmin) {
          showAlert("Akses ditolak (Forbidden)! Hanya Root Admin yang dapat menambah produk baru.", "Forbidden");
          return;
        }

        const initialStockNum = Number(productForm.initialStock) || 0;
        const newProductPayload = {
          sku: productForm.sku,
          itemName: productForm.itemName,
          familyCode: productForm.familyCode,
          weightInGrams: Number(productForm.weightInGrams),
          productActive: isActiveBool,
          active: isActiveBool,
          status: statusText,
          purchasingPrice: Number(productForm.purchasingPrice),
          netPrice: Number(productForm.netPrice),
          initialStock: initialStockNum,
          stock: initialStockNum,
          currentStock: initialStockNum,
          createdAt: serverTimestamp(),
        };

        const newDocRef = await addDoc(collection(db, "products"), newProductPayload);

        if (initialStockNum > 0) {
          try {
            await addDoc(collection(db, "sop_postings"), {
              postingNo: `INIT-${productForm.sku}`,
              date: serverTimestamp(),
              movement_type: "ADJUSTMENT (SOP Posting)",
              notes: `Stok awal produk baru [${productForm.sku}] oleh ${currentUser.name}`,
              items: [
                {
                  productId: newDocRef.id,
                  sku: productForm.sku,
                  itemName: productForm.itemName,
                  qty: initialStockNum,
                },
              ],
            });
          } catch (mErr) {
            console.error("Gagal mencatat mutasi stok awal:", mErr);
          }
        }

        showAlert(`Produk [${productForm.sku}] berhasil ditambahkan dengan status ${statusText}!`, "Sukses");
      }

      setIsProductModalOpen(false);
      loadData();
    } catch (err) {
      console.error("Gagal menyimpan produk:", err);
      showAlert("Terjadi kesalahan saat menyimpan produk.", "Kesalahan");
    }
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!isRootAdmin) {
      showAlert("Akses ditolak (Forbidden)! Hanya Root Admin yang dapat mengelola akun user.", "Forbidden");
      return;
    }

    try {
      if (isEditingUser && editingUserId) {
        const updatePayload: any = {
          username: userForm.username.trim(),
          fullName: userForm.fullName.trim(),
          role: userForm.role,
        };

        if (userForm.password.trim()) {
          const buffer = new TextEncoder().encode(userForm.password);
          const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          updatePayload.passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        }

        await updateDoc(doc(db, "portal_users", editingUserId), updatePayload);
        showAlert(`Data pengguna ${userForm.username} berhasil diperbarui!`, "Sukses");
      } else {
        if (!userForm.password) {
          showAlert("Password wajib diisi untuk pengguna baru!", "Peringatan");
          return;
        }

        const buffer = new TextEncoder().encode(userForm.password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        await addDoc(collection(db, "portal_users"), {
          username: userForm.username.trim(),
          fullName: userForm.fullName.trim(),
          passwordHash: passwordHash,
          role: userForm.role,
          createdAt: serverTimestamp(),
        });

        showAlert(`Akun untuk ${userForm.username} dengan role ${userForm.role} berhasil dibuat!`, "Sukses");
      }

      setIsUserModalOpen(false);
      setUserForm({ username: "", fullName: "", password: "", role: "Staff" });
      loadData();
    } catch (err) {
      console.error("Gagal memproses user:", err);
      showAlert("Gagal memproses data user.", "Kesalahan");
    }
  }

  async function executeDeleteUser() {
    if (!deleteTargetUser) return;
    if (!isRootAdmin) {
      showAlert("Forbidden! Hanya Root Admin yang dapat menghapus pengguna.", "Forbidden");
      setDeleteTargetUser(null);
      return;
    }

    try {
      await deleteDoc(doc(db, "portal_users", deleteTargetUser.id));
      showAlert(`User "${deleteTargetUser.username}" berhasil dihapus.`, "Sukses");
      setDeleteTargetUser(null);
      loadData();
    } catch (err) {
      console.error("Gagal menghapus user:", err);
      showAlert("Gagal menghapus user dari database.", "Kesalahan");
    }
  }

  const isStaff = currentUser.role === "Staff";

  return (
    <div className="flex h-screen bg-[#FFF5F6] font-sans text-rose-950">
      {/* SIDEBAR */}
      <aside className="w-72 bg-[#4A2033] text-rose-100 flex flex-col shadow-xl border-r border-[#6E354F]">
        <div className="p-5 border-b border-[#6E354F]">
          <h1 className="text-base font-bold tracking-tight text-white leading-snug">
            Warehouse Management System
          </h1>
          <p className="text-[11px] text-rose-300 mt-1 leading-relaxed">
            Report Portal by Atin&apos;s Collection IT Support
          </p>
          <div className="mt-3 px-2 py-1.5 bg-[#5C2B42] rounded text-[11px] flex justify-between items-center text-rose-200">
            <span>Login: <b className="text-white">{currentUser.name}</b></span>
            {isRootAdmin && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider">
                Root
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-3">
          {MENU_GROUPS.map((grp) => {
            const isGroupOpen = !!openDropdowns[grp.group];
            const hasActiveChild = grp.items.some((i) => i.key === activeMenu);

            return (
              <div key={grp.group} className="border-b border-[#5C2B42]/50 pb-2">
                <button
                  type="button"
                  onClick={() => toggleDropdown(grp.group)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                    hasActiveChild ? "text-white bg-[#5C2B42]/40" : "text-rose-300 hover:bg-[#5C2B42]/30"
                  }`}
                >
                  <span>{grp.group}</span>
                  <span className={`text-[10px] transition-transform duration-200 ${isGroupOpen ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>

                {isGroupOpen && (
                  <div className="mt-1 pl-2 space-y-1">
                    {grp.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveMenu(item.key)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex flex-col cursor-pointer ${
                          activeMenu === item.key
                            ? "bg-[#BE185D] text-white font-medium shadow-sm"
                            : "hover:bg-[#5C2B42] text-rose-200"
                        }`}
                      >
                        <span className="font-semibold text-sm">{item.label}</span>
                        <span className="text-[11px] opacity-80 mt-0.5 line-clamp-1">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#6E354F]">
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="w-full py-2.5 px-3 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow"
          >
            Keluar (Logout)
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-rose-100 px-8 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-rose-950 capitalize">{activeLabel}</h2>
            <p className="text-xs text-rose-600 mt-0.5">
              Menampilkan {displayRows.length} baris data
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {activeMenu !== "assortment" && activeMenu !== "user_management" && (
              <div className="flex items-center bg-rose-50/70 border border-rose-200 rounded-lg px-2.5 py-1.5 gap-2 text-xs">
                <span className="text-rose-700 font-medium">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-rose-900 focus:outline-none"
                />
                <span className="text-rose-700 font-medium">S/D:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-rose-900 focus:outline-none"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            <input
              type="text"
              placeholder="Cari data..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 px-3 py-1.5 border border-rose-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
            />

            {/* TOMBOL TAMBAH PRODUK BARU */}
            {activeMenu === "assortment" && (
              isRootAdmin ? (
                <button
                  type="button"
                  onClick={async () => {
                    setIsEditingProduct(false);
                    setEditingProductId(null);
                    const defaultFam = familiesList.length > 0 ? familiesList[0].familyCode : "";
                    setIsProductModalOpen(true);
                    if (defaultFam) {
                      setIsGeneratingSku(true);
                      const autoSku = await fetchLastSkuForFamily(defaultFam);
                      setProductForm({
                        sku: autoSku,
                        itemName: "",
                        familyCode: defaultFam,
                        weightInGrams: 0,
                        productActive: true,
                        purchasingPrice: 0,
                        netPrice: 0,
                        initialStock: 0,
                      });
                      setIsGeneratingSku(false);
                    } else {
                      setProductForm({
                        sku: "",
                        itemName: "",
                        familyCode: "",
                        weightInGrams: 0,
                        productActive: true,
                        purchasingPrice: 0,
                        netPrice: 0,
                        initialStock: 0,
                      });
                    }
                  }}
                  className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  + Tambah Produk Baru
                </button>
              ) : (
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-medium">
                  🔒 Tambah Produk: Khusus Root Admin
                </span>
              )
            )}

            {/* TOMBOL USER MANAGEMENT */}
            {activeMenu === "user_management" && (
              isRootAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUser(false);
                    setEditingUserId(null);
                    setUserForm({ username: "", fullName: "", password: "", role: "Staff" });
                    setIsUserModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  + Buat User Baru
                </button>
              ) : (
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-medium">
                  🔒 User Creation: Restricted to Root Admin
                </span>
              )
            )}

            {!isStaff ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>📊</span> Excel
                </button>
                <button
                  type="button"
                  onClick={exportToPDF}
                  className="px-3 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>📄</span> PDF
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-rose-500 bg-rose-100/60 px-2.5 py-1 rounded border border-rose-200">
                Akses Download Terbatas (Staff)
              </span>
            )}
          </div>
        </header>

        <section className="flex-1 overflow-auto p-8">
          <div className="bg-white rounded-xl shadow-sm border border-rose-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-rose-700 text-sm">
                <div className="inline-block animate-spin w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full mb-2"></div>
                <div>Memuat data laporan...</div>
              </div>
            ) : displayRows.length === 0 ? (
              <div className="p-12 text-center text-rose-400 text-sm">
                Tidak ada data ditemukan untuk kriteria ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#FCE7F3]/70 border-b border-rose-100 uppercase font-semibold text-rose-900">
                    <tr>
                      {dynamicColumns.map((col) => (
                        <th key={col} className="px-4 py-3 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                      {(activeMenu === "assortment" ||
                        activeMenu === "receiving_report" ||
                        activeMenu === "user_management") && (
                        <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50">
                    {displayRows.map((row, idx) => (
                      <tr key={row._raw?.id || row.id || idx} className="hover:bg-rose-50/50 transition-colors">
                        {dynamicColumns.map((col) => {
                          const val = row[col];
                          let displayVal = "-";

                          if (val !== undefined && val !== null) {
                            if (typeof val === "object") {
                              if (val.seconds) {
                                displayVal = new Date(val.seconds * 1000).toLocaleString("id-ID");
                              } else {
                                displayVal = JSON.stringify(val);
                              }
                            } else {
                              displayVal = String(val);
                            }
                          }

                          return (
                            <td key={col} className="px-4 py-3 whitespace-nowrap text-rose-950 max-w-xs truncate">
                              {displayVal}
                            </td>
                          );
                        })}

                        {activeMenu === "assortment" && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {!isStaff ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const raw = row._raw || row;
                                  setIsEditingProduct(true);
                                  setEditingProductId(row.id);
                                  const activeState = resolveIsProductActive(raw);

                                  setProductForm({
                                    sku: raw.sku || "",
                                    itemName: raw.itemName || "",
                                    familyCode: raw.familyCode || "",
                                    weightInGrams: Number(raw.weightInGrams ?? 0),
                                    productActive: activeState,
                                    purchasingPrice: Number(raw.purchasingPrice || 0),
                                    netPrice: Number(raw.netPrice || 0),
                                    initialStock: Number(raw.stock || raw.initialStock || 0),
                                  });
                                  setIsProductModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-medium transition cursor-pointer"
                              >
                                ✏️ Edit
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Hanya Baca</span>
                            )}
                          </td>
                        )}

                        {activeMenu === "receiving_report" && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {!isStaff ? (
                              <button
                                type="button"
                                onClick={() => handleGenerateSingleReceiving(row)}
                                className="px-2.5 py-1 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ml-auto"
                              >
                                <span>📄</span> Generate Report
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Hanya Baca</span>
                            )}
                          </td>
                        )}

                        {activeMenu === "user_management" && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isRootAdmin ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const raw = row._raw || row;
                                    setIsEditingUser(true);
                                    setEditingUserId(raw.id);
                                    setUserForm({
                                      username: raw.username || "",
                                      fullName: raw.fullName || "",
                                      password: "",
                                      role: raw.role || "Staff",
                                    });
                                    setIsUserModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-medium transition cursor-pointer"
                                >
                                  ✏️ Edit / Ganti Password
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const raw = row._raw || row;
                                    setDeleteTargetUser({ id: raw.id, username: raw.username || "user" });
                                  }}
                                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-medium transition cursor-pointer"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Forbidden (Root Only)</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* CUSTOM ALERT POP-UP */}
      {alertInfo.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-100 text-center">
            <h3 className="text-base font-bold text-rose-950 mb-2">{alertInfo.title}</h3>
            <p className="text-xs text-rose-700 mb-6">{alertInfo.message}</p>
            <button
              type="button"
              onClick={() => setAlertInfo({ isOpen: false, title: "", message: "" })}
              className="w-full py-2.5 px-4 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION POP-UP LOGOUT */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-100">
            <h3 className="text-base font-bold text-rose-950 mb-2">Konfirmasi Keluar</h3>
            <p className="text-xs text-rose-700 mb-6">Apakah Anda yakin ingin keluar dari sesi portal ini?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={proceedLogout}
                className="px-4 py-2 bg-[#9F1239] hover:bg-[#881337] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI DELETE USER (ROOT ADMIN) */}
      {deleteTargetUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-red-200">
            <div className="flex items-center gap-2 mb-2 text-red-600 font-bold text-sm">
              <span>⚠️</span>
              <h4>Hapus Pengguna</h4>
            </div>
            <p className="text-xs text-gray-700 mb-6">
              Apakah Anda yakin ingin menghapus user <b>{deleteTargetUser.username}</b>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteUser}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Hapus User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT / TAMBAH PRODUK */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-rose-100">
            <h3 className="text-base font-bold text-rose-950 mb-1">
              {isEditingProduct ? "Edit Parameter Produk" : "Tambah Produk Baru"}
            </h3>
            <p className="text-xs text-rose-500 mb-4">
              {isEditingProduct
                ? "Hanya memperbarui parameter katalog produk WMS"
                : "Khusus Root Admin - Mengisi katalog & stok awal sistem"}
            </p>

            <form onSubmit={handleProductFormSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                  Fam Code (Pilih Famili)
                </label>
                <select
                  required
                  value={productForm.familyCode}
                  onChange={(e) => handleFamilyChange(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none bg-white font-medium"
                >
                  <option value="">-- Pilih Fam Code --</option>
                  {familiesList.map((f) => (
                    <option key={f.id} value={f.familyCode}>
                      {f.familyName ? `${f.familyName} (${f.familyCode})` : f.familyCode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-900 mb-1 flex justify-between">
                  <span>SKU (Otomatis & Nonaktif/Disable)</span>
                  {isGeneratingSku && <span className="text-rose-500 animate-pulse text-[10px]">Mengecek nomor terakhir...</span>}
                </label>
                <input
                  type="text"
                  disabled
                  value={productForm.sku}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-100 text-slate-500 font-bold cursor-not-allowed select-none"
                  placeholder="Pilih Fam Code untuk generate SKU..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-900 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={productForm.itemName}
                  onChange={(e) => setProductForm({ ...productForm, itemName: e.target.value })}
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none"
                  placeholder="Nama barang..."
                />
              </div>

              {!isEditingProduct && (
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                  <label className="block text-[11px] font-bold text-amber-900 mb-1 flex justify-between">
                    <span>Stok Awal (Initial Stock)</span>
                    <span className="text-[10px] text-amber-700 font-normal">Tanpa perlu buat PO baru</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={productForm.initialStock}
                    onChange={(e) => setProductForm({ ...productForm, initialStock: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="0"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                    Weight (weightInGrams)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      required
                      value={productForm.weightInGrams}
                      onChange={(e) => setProductForm({ ...productForm, weightInGrams: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] text-slate-400">grams</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                    Status (productActive)
                  </label>
                  <select
                    value={productForm.productActive ? "true" : "false"}
                    onChange={(e) => setProductForm({ ...productForm, productActive: e.target.value === "true" })}
                    className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none bg-white font-medium"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-rose-900 mb-1">Purchasing Price</label>
                  <input
                    type="number"
                    required
                    value={productForm.purchasingPrice}
                    onChange={(e) => setProductForm({ ...productForm, purchasingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-rose-900 mb-1">Net Price</label>
                  <input
                    type="number"
                    required
                    value={productForm.netPrice}
                    onChange={(e) => setProductForm({ ...productForm, netPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-rose-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingSku || (!isEditingProduct && !productForm.sku)}
                  className="px-4 py-2 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-rose-300 text-white text-xs font-semibold rounded-lg cursor-pointer shadow"
                >
                  {isEditingProduct ? "Simpan Perubahan" : "Simpan Produk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP COUNTDOWN KONFIRMASI KREDENSIAL EDIT PRODUK (10 DETIK) */}
      {isSecurityConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-rose-200 animate-fadeIn">
            <div className="flex items-center gap-3 mb-3">
              <span className="p-2 bg-amber-100 text-amber-700 rounded-full text-lg">⚠️</span>
              <h3 className="text-base font-bold text-rose-950">Konfirmasi Perubahan</h3>
            </div>
            <p className="text-sm font-semibold text-rose-900 mb-2">
              Apakah perubahan sudah sesuai ?
            </p>
            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200 mb-6 leading-relaxed">
              Perhatian: Anda sedang memodifikasi data kredensial/katalog produk. Verifikasi kembali sebelum menekan OK.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSecurityConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={countdown > 0}
                onClick={executeSaveProduct}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition text-white ${
                  countdown > 0
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-[#BE185D] hover:bg-[#9D174D] cursor-pointer shadow"
                }`}
              >
                {countdown > 0 ? `OK (${countdown}s)` : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL USER MANAGEMENT */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-100">
            <h3 className="text-base font-bold text-rose-950 mb-1">
              {isEditingUser ? "Edit User & Ganti Password" : "Buat Akun Portal Baru"}
            </h3>
            <p className="text-xs text-rose-500 mb-4">
              Khusus otoritas Root Admin WMS Atin&apos;s Collection
            </p>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-rose-900 mb-1">Username / ID</label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none"
                  placeholder="misal: staff01"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-900 mb-1">Nama Lengkap (Full Name)</label>
                <input
                  type="text"
                  required
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none"
                  placeholder="misal: Budi Santoso"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                  {isEditingUser ? "Ganti Password (Kosongkan jika tetap)" : "Password"}
                </label>
                <input
                  type="password"
                  required={!isEditingUser}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-900 mb-1">Role Akses</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-[#BE185D] outline-none bg-white"
                >
                  <option value="Root Admin">Root Admin (Akses Penuh Kelola User)</option>
                  <option value="Admin">Admin (Bisa Lihat & Download Report)</option>
                  <option value="Staff">Staff (Hanya Baca, Tidak Bisa Download)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-rose-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {isEditingUser ? "Simpan Perubahan" : "Buat Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}