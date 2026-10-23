import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { konterFirestore } from "./firebaseKonter";

// ==========================================
// OPERATIONAL SERVICE (Lengkap Semua Modul)
// ==========================================
export const operationalService = {
  // 1. Produk Konter
  async getProducts(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_products"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Gagal getProducts:", e);
      return [];
    }
  },

  async saveProduct(productForm: any, editingProductId?: string): Promise<void> {
    if (editingProductId) {
      await updateDoc(doc(konterFirestore, "konter_products", editingProductId), {
        ...productForm,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(konterFirestore, "konter_products"), {
        ...productForm,
        createdAt: serverTimestamp(),
      });
    }
  },

  async importProducts(productsToImport: any[]): Promise<number> {
    const batch = writeBatch(konterFirestore);
    let count = 0;
    for (const prod of productsToImport) {
      const ref = doc(collection(konterFirestore, "konter_products"));
      batch.set(ref, {
        ...prod,
        createdAt: serverTimestamp(),
      });
      count++;
    }
    await batch.commit();
    return count;
  },

  async generateNextSKU(familyCode: string): Promise<string> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_products"));
      const prefix = (familyCode || "PRD").toUpperCase();
      const existing = snap.docs
        .map((d) => (d.data() as any).sku || "")
        .filter((sku: string) => sku.startsWith(prefix));

      let maxNum = 0;
      existing.forEach((sku: string) => {
        const numPart = parseInt(sku.replace(prefix, ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      });
      return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
    } catch {
      return `${(familyCode || "PRD").toUpperCase()}0001`;
    }
  },

  // 2. Family / Kategori
  async getFamilies(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_families"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Gagal getFamilies:", e);
      return [];
    }
  },

  async createFamily(name: string, description?: string): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_families"), {
      name,
      description: description || "",
      createdAt: serverTimestamp(),
    });
  },

  async updateFamily(id: string, name: string, description?: string): Promise<void> {
    await updateDoc(doc(konterFirestore, "konter_families", id), {
      name,
      description: description || "",
      updatedAt: serverTimestamp(),
    });
  },

  async deleteFamily(id: string): Promise<void> {
    await deleteDoc(doc(konterFirestore, "konter_families", id));
  },

  // 3. Stock Adjustment
  async getAdjustments(): Promise<any[]> {
    try {
      const q = query(
        collection(konterFirestore, "konter_stock_adjustments"),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      try {
        const snap = await getDocs(collection(konterFirestore, "konter_stock_adjustments"));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error("Gagal getAdjustments:", e);
        return [];
      }
    }
  },

  async createAdjustment(data: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_stock_adjustments"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  async executeStockAdjustment(adjData: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_stock_adjustments"), {
      ...adjData,
      createdAt: serverTimestamp(),
    });
    // Jika ada penyesuaian stok langsung ke produk
    if (adjData.productId && adjData.finalStock !== undefined) {
      try {
        await updateDoc(doc(konterFirestore, "konter_products", adjData.productId), {
          stock: adjData.finalStock,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("Update stock pada produk dilewati:", e);
      }
    }
  },

  // 4. Stock Movements (Log Pergerakan Barang)
  async getMovements(limitCount = 100): Promise<any[]> {
    try {
      const q = query(
        collection(konterFirestore, "konter_stock_movements"),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      try {
        const snap = await getDocs(collection(konterFirestore, "konter_stock_movements"));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error("Gagal getMovements:", e);
        return [];
      }
    }
  },

  async createMovement(data: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_stock_movements"), {
      ...data,
      timestamp: serverTimestamp(),
    });
  },

  // 5. Purchase Order
  async getPurchaseOrders(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_purchase_orders"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Gagal getPurchaseOrders:", e);
      return [];
    }
  },

  async createPurchaseOrder(poData: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_purchase_orders"), {
      ...poData,
      createdAt: serverTimestamp(),
    });
  },

  async cancelPurchaseOrder(poId: string, reason: string, cancelledBy = "Admin"): Promise<void> {
    await updateDoc(doc(konterFirestore, "konter_purchase_orders", poId), {
      status: "CANCELLED",
      cancelReason: reason,
      cancelledBy,
      updatedAt: serverTimestamp(),
    });
  },

  // 6. Receiving
  async getReceivings(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_receivings"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Gagal getReceivings:", e);
      return [];
    }
  },

  async createReceiving(data: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_receivings"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  async executeReceiving(data: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_receivings"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    if (data.poId) {
      try {
        await updateDoc(doc(konterFirestore, "konter_purchase_orders", data.poId), {
          status: "RECEIVED",
          updatedAt: serverTimestamp(),
        });
      } catch {}
    }
  },

  // 7. Penjualan & Transaksi Konter
  async getSales(startDate?: string, endDate?: string): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_sales"));
      let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (startDate) {
        docs = docs.filter((item: any) => (item.date || item.createdAt || "") >= startDate);
      }
      if (endDate) {
        docs = docs.filter((item: any) => (item.date || item.createdAt || "") <= endDate);
      }
      return docs;
    } catch (e) {
      console.error("Gagal getSales:", e);
      return [];
    }
  },

  async importSalesBatch(
    rawJson: any,
    operatorName = "Admin"
  ): Promise<{ success: boolean; count: number; successCount: number; failedCount: number; errors: string[] }> {
    try {
      const items = Array.isArray(rawJson) ? rawJson : [rawJson];
      const batch = writeBatch(konterFirestore);
      items.forEach((item) => {
        const ref = doc(collection(konterFirestore, "konter_sales"));
        batch.set(ref, {
          ...item,
          importedBy: operatorName,
          importedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      return {
        success: true,
        count: items.length,
        successCount: items.length,
        failedCount: 0,
        errors: [],
      };
    } catch (e: any) {
      console.error("Gagal importSalesBatch:", e);
      return {
        success: false,
        count: 0,
        successCount: 0,
        failedCount: Array.isArray(rawJson) ? rawJson.length : 1,
        errors: [e?.message || "Terjadi kesalahan saat menyimpan transaksi penjualan."],
      };
    }
  },

  async clearSalesByDate(targetDate: string): Promise<number> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_sales"));
      const toDelete = snap.docs.filter((d) => (d.data() as any).date === targetDate);
      const batch = writeBatch(konterFirestore);
      toDelete.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return toDelete.length;
    } catch (e) {
      console.error("Gagal clearSalesByDate:", e);
      return 0;
    }
  },
};

// ==========================================
// SUPPLIER OPERATIONAL SERVICE
// ==========================================
export const supplierOperationalService = {
  async getSuppliers(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_suppliers"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  },

  async getPurchaseOrders(): Promise<any[]> {
    return operationalService.getPurchaseOrders();
  },

  async getReceivings(): Promise<any[]> {
    return operationalService.getReceivings();
  },

  async saveSupplier(supplierData: any, editingId?: string): Promise<void> {
    if (editingId) {
      await updateDoc(doc(konterFirestore, "konter_suppliers", editingId), {
        ...supplierData,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(konterFirestore, "konter_suppliers"), {
        ...supplierData,
        createdAt: serverTimestamp(),
      });
    }
  },

  async createPurchaseOrder(poData: any): Promise<void> {
    return operationalService.createPurchaseOrder(poData);
  },

  async deleteSupplier(id: string): Promise<void> {
    await deleteDoc(doc(konterFirestore, "konter_suppliers", id));
  },
};

// ==========================================
// CASH COUNT & PIUTANG SERVICE
// ==========================================
export const cashCountService = {
  async getCashCounts(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_cash_counts_v2"));
      return snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          date:
            raw.date ||
            raw.createdAt?.toDate?.()?.toISOString()?.slice(0, 10) ||
            new Date().toISOString().slice(0, 10),
          shift: raw.shift || "Shift 1",
          cashierName: raw.cashierName || raw.cashier || "Kasir",
          actualTotal: raw.actualTotal ?? raw.totalActual ?? raw.physicalCash ?? 0,
          systemTotal: raw.systemTotal ?? raw.totalSystem ?? raw.systemCash ?? 0,
          difference: raw.difference ?? raw.selisih ?? 0,
        };
      });
    } catch (err: any) {
      console.error("[CashCount Error]:", err?.message || err);
      return [];
    }
  },

  async getPiutangs(): Promise<any[]> {
    try {
      let snap = await getDocs(collection(konterFirestore, "konter_piutang"));
      if (snap.empty) {
        snap = await getDocs(collection(konterFirestore, "konter_piutangs"));
      }
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err: any) {
      console.error("[Piutang Error]:", err?.message || err);
      return [];
    }
  },

  async getPiutangList(): Promise<any[]> {
    return this.getPiutangs();
  },

  async saveCashCount(data: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_cash_counts_v2"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  async savePiutang(data: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_piutang"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  async payPiutang(id: string, amount: number, notes?: string): Promise<void> {
    try {
      await updateDoc(doc(konterFirestore, "konter_piutang", id), {
        paidAmount: amount,
        notes: notes || "",
        updatedAt: serverTimestamp(),
      });
    } catch {
      await updateDoc(doc(konterFirestore, "konter_piutangs", id), {
        paidAmount: amount,
        notes: notes || "",
        updatedAt: serverTimestamp(),
      });
    }
  },
};
