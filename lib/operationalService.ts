import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { konterFirestore } from "./firebase";
import type { KonterProduct, KonterProductFamily } from "./types";

export const operationalService = {
  // ================= 1. MASTER PRODUCTS =================
  async getProducts(): Promise<KonterProduct[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_products"));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    } catch (e) {
      console.warn("Gagal getProducts:", e);
      return [];
    }
  },

  async saveProduct(product: Partial<KonterProduct>, id?: string): Promise<string> {
    const payload: any = {
      ...product,
      updatedAt: serverTimestamp(),
    };
    if (id) {
      await updateDoc(doc(konterFirestore, "konter_products", id), payload);
      return id;
    } else {
      payload.createdAt = serverTimestamp();
      const res = await addDoc(collection(konterFirestore, "konter_products"), payload);
      return res.id;
    }
  },

  async deleteProduct(id: string): Promise<void> {
    await deleteDoc(doc(konterFirestore, "konter_products", id));
  },

  async generateNextSKU(familyCode: string): Promise<string> {
    try {
      const q = query(
        collection(konterFirestore, "konter_products"),
        where("familyCode", "==", familyCode)
      );
      const snap = await getDocs(q);
      const cleanFam = familyCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      let maxNum = 0;
      snap.docs.forEach((d) => {
        const sku = (d.data().sku || "") as string;
        const match = sku.match(/(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      return `${cleanFam}-${String(maxNum + 1).padStart(3, "0")}`;
    } catch (e) {
      return `${familyCode}-${Date.now().toString().slice(-4)}`;
    }
  },

  async importProducts(items: any[]): Promise<number> {
    const batch = writeBatch(konterFirestore);
    let count = 0;
    for (const item of items) {
      const ref = doc(collection(konterFirestore, "konter_products"));
      batch.set(ref, {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }
    await batch.commit();
    return count;
  },

  // ================= 2. MASTER FAMILIES =================
  async getFamilies(): Promise<KonterProductFamily[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_families"));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    } catch (e) {
      console.warn("Gagal getFamilies:", e);
      return [];
    }
  },

  async createFamily(name: string, description?: string, code?: string): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_families"), {
      code: code || "",
      name,
      description: description || "",
      createdAt: serverTimestamp(),
    });
  },

  async updateFamily(id: string, name: string, description?: string, code?: string): Promise<void> {
    const payload: any = {
      name,
      description: description || "",
      updatedAt: serverTimestamp(),
    };
    if (code) payload.code = code;
    await updateDoc(doc(konterFirestore, "konter_families", id), payload);
  },

  async deleteFamily(id: string): Promise<void> {
    await deleteDoc(doc(konterFirestore, "konter_families", id));
  },

  // ================= 3. SUPPLIERS =================
  async getSuppliers(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_suppliers"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Gagal getSuppliers:", e);
      return [];
    }
  },

  async saveSupplier(supplier: any, id?: string): Promise<void> {
    const payload = { ...supplier, updatedAt: serverTimestamp() };
    if (id) {
      await updateDoc(doc(konterFirestore, "konter_suppliers", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(konterFirestore, "konter_suppliers"), payload);
    }
  },

  async deleteSupplier(id: string): Promise<void> {
    await deleteDoc(doc(konterFirestore, "konter_suppliers", id));
  },

  // ================= 4. PURCHASE ORDERS & RECEIVING =================
  async getPurchaseOrders(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_purchase_orders"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Gagal getPurchaseOrders:", e);
      return [];
    }
  },

  async savePurchaseOrder(po: any, id?: string): Promise<void> {
    const payload = { ...po, updatedAt: serverTimestamp() };
    if (id) {
      await updateDoc(doc(konterFirestore, "konter_purchase_orders", id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(konterFirestore, "konter_purchase_orders"), payload);
    }
  },

  async getReceivings(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_receivings"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Gagal getReceivings:", e);
      return [];
    }
  },

  async saveReceiving(rec: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_receivings"), {
      ...rec,
      createdAt: serverTimestamp(),
    });
  },

  // ================= 5. PENJUALAN (SALES) =================
  async getSales(limitCount = 200): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_sales"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      }).slice(0, limitCount);
    } catch (e) {
      console.warn("Gagal getSales:", e);
      return [];
    }
  },

  async saveSale(saleData: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_sales"), {
      ...saleData,
      createdAt: serverTimestamp(),
    });
  },

  // ================= 6. CASH COUNT =================
  async getCashCounts(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_cash_counts"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Gagal getCashCounts:", e);
      return [];
    }
  },

  async saveCashCount(data: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_cash_counts"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  // ================= 7. STOCK ADJUSTMENT =================
  async getAdjustments(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_stock_adjustments"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
    } catch (e) {
      console.warn("Gagal getAdjustments:", e);
      return [];
    }
  },

  async executeStockAdjustment(params: {
    productId: string;
    physicalStock: number;
    reason: string;
    operatorName?: string;
  }): Promise<void> {
    const prodRef = doc(konterFirestore, "konter_products", params.productId);
    const prodSnap = await getDoc(prodRef);
    if (!prodSnap.exists()) throw new Error("Produk tidak ditemukan");

    const prodData = prodSnap.data() as any;
    const currentStock = Number(prodData.currentStock) || 0;
    const diff = params.physicalStock - currentStock;
    const refCode = "ADJ-" + Date.now();
    const nowStr = new Date().toISOString();

    const batch = writeBatch(konterFirestore);

    batch.update(prodRef, {
      currentStock: params.physicalStock,
      updatedAt: serverTimestamp(),
    });

    const adjRef = doc(collection(konterFirestore, "konter_stock_adjustments"));
    batch.set(adjRef, {
      refCode,
      productId: params.productId,
      productName: prodData.name || "",
      sku: prodData.sku || "",
      systemStock: currentStock,
      physicalStock: params.physicalStock,
      difference: diff,
      reason: params.reason,
      operator: params.operatorName || "Admin",
      createdAt: serverTimestamp(),
    });

    const moveRef = doc(collection(konterFirestore, "konter_stock_movements"));
    batch.set(moveRef, {
      refCode,
      sku: prodData.sku || "",
      productName: prodData.name || "",
      type: diff >= 0 ? "IN_ADJUSTMENT" : "OUT_ADJUSTMENT",
      qty: Math.abs(diff),
      balanceBefore: currentStock,
      balanceAfter: params.physicalStock,
      notes: params.reason,
      createdAt: serverTimestamp(),
    });

    const cardRef = doc(collection(konterFirestore, "konter_stock_cards"));
    batch.set(cardRef, {
      date: nowStr,
      refCode,
      productId: params.productId,
      sku: prodData.sku || "",
      productName: prodData.name || "",
      flow: diff >= 0 ? "IN" : "OUT",
      qty: Math.abs(diff),
      remainingStock: params.physicalStock,
      notes: "Stock Adjustment: " + params.reason,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  // ================= 8. STOCK MOVEMENTS & STOCK CARDS =================
  async getMovements(limitCount = 150): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_stock_movements"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      }).slice(0, limitCount);
    } catch (e) {
      console.warn("Gagal getMovements:", e);
      return [];
    }
  },

  async getStockCards(productId?: string): Promise<any[]> {
    try {
      let q = collection(konterFirestore, "konter_stock_cards") as any;
      if (productId) {
        q = query(q, where("productId", "==", productId));
      }
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
    } catch (e) {
      console.warn("Gagal getStockCards:", e);
      return [];
    }
  },

  // ================= 9. INTERNAL PURCHASE & RULES =================
  async getIPRules(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_ip_rules"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Gagal getIPRules:", e);
      return [];
    }
  },

  async saveIPRule(rule: { sourceProductId: string; targetProductId: string; ratio: number; notes?: string }): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_ip_rules"), {
      ...rule,
      createdAt: serverTimestamp(),
    });
  },

  async deleteIPRule(id: string): Promise<void> {
    await deleteDoc(doc(konterFirestore, "konter_ip_rules", id));
  },

  async processInternalPurchase(params: {
    sourceProduct: any;
    targetProduct: any;
    qtySource: number;
    qtyTarget: number;
    sellingPriceTarget: number;
    capitalPriceTarget: number;
    notes?: string;
    operator?: string;
  }): Promise<void> {
    if (params.qtySource < params.qtyTarget) {
      throw new Error("Jumlah Qty Product Source tidak boleh lebih kecil dari Qty Product Target!");
    }

    const batch = writeBatch(konterFirestore);
    const nowStr = new Date().toISOString();
    const refCode = "IP-" + Date.now();

    const sourceRef = doc(konterFirestore, "konter_products", params.sourceProduct.id);
    const newSourceStock = Math.max(0, (params.sourceProduct.currentStock || 0) - params.qtySource);
    batch.update(sourceRef, {
      currentStock: newSourceStock,
      updatedAt: serverTimestamp(),
    });

    const targetRef = doc(konterFirestore, "konter_products", params.targetProduct.id);
    const newTargetStock = (params.targetProduct.currentStock || 0) + params.qtyTarget;
    batch.update(targetRef, {
      currentStock: newTargetStock,
      sellingPrice: Number(params.sellingPriceTarget) || 0,
      capitalPrice: Number(params.capitalPriceTarget) || 0,
      updatedAt: serverTimestamp(),
    });

    const adjRef = doc(collection(konterFirestore, "konter_stock_adjustments"));
    batch.set(adjRef, {
      refCode,
      type: "INTERNAL_PURCHASE",
      sourceProductId: params.sourceProduct.id,
      sourceSku: params.sourceProduct.sku || "",
      sourceName: params.sourceProduct.name || "",
      qtySource: params.qtySource,
      targetProductId: params.targetProduct.id,
      targetSku: params.targetProduct.sku || "",
      targetName: params.targetProduct.name || "",
      qtyTarget: params.qtyTarget,
      sellingPriceTarget: Number(params.sellingPriceTarget) || 0,
      capitalPriceTarget: Number(params.capitalPriceTarget) || 0,
      notes: params.notes || "Konversi Internal Purchase Blank Voucher",
      operator: params.operator || "Admin",
      createdAt: serverTimestamp(),
    });

    const moveSrc = doc(collection(konterFirestore, "konter_stock_movements"));
    batch.set(moveSrc, {
      refCode,
      sku: params.sourceProduct.sku || "",
      productName: params.sourceProduct.name || "",
      type: "OUT_INTERNAL_PURCHASE",
      qty: params.qtySource,
      balanceBefore: params.sourceProduct.currentStock || 0,
      balanceAfter: newSourceStock,
      notes: "Inject ke " + params.targetProduct.name,
      createdAt: serverTimestamp(),
    });

    const moveTgt = doc(collection(konterFirestore, "konter_stock_movements"));
    batch.set(moveTgt, {
      refCode,
      sku: params.targetProduct.sku || "",
      productName: params.targetProduct.name || "",
      type: "IN_INTERNAL_PURCHASE",
      qty: params.qtyTarget,
      balanceBefore: params.targetProduct.currentStock || 0,
      balanceAfter: newTargetStock,
      notes: "Hasil IP dari " + params.sourceProduct.name,
      createdAt: serverTimestamp(),
    });

    const cardSrc = doc(collection(konterFirestore, "konter_stock_cards"));
    batch.set(cardSrc, {
      date: nowStr,
      refCode,
      productId: params.sourceProduct.id,
      sku: params.sourceProduct.sku || "",
      productName: params.sourceProduct.name || "",
      flow: "OUT",
      qty: params.qtySource,
      remainingStock: newSourceStock,
      notes: "Konversi IP -> " + params.targetProduct.name,
      createdAt: serverTimestamp(),
    });

    const cardTgt = doc(collection(konterFirestore, "konter_stock_cards"));
    batch.set(cardTgt, {
      date: nowStr,
      refCode,
      productId: params.targetProduct.id,
      sku: params.targetProduct.sku || "",
      productName: params.targetProduct.name || "",
      flow: "IN",
      qty: params.qtyTarget,
      remainingStock: newTargetStock,
      notes: "Hasil IP dari " + params.sourceProduct.name,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  // ================= 10. TRANSFERS =================
  async getTransfers(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_stock_transfers"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Gagal getTransfers:", e);
      return [];
    }
  },

  async saveTransfer(transfer: any): Promise<void> {
    await addDoc(collection(konterFirestore, "konter_stock_transfers"), {
      ...transfer,
      createdAt: serverTimestamp(),
    });
  },

  // ================= 11. PIUTANG (RECEIVABLES) =================
  async getPiutangList(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_piutang"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
    } catch (e) {
      console.warn("Gagal getPiutangList:", e);
      return [];
    }
  },

  async savePiutang(data: any, id?: string): Promise<string> {
    const payload = { ...data, updatedAt: serverTimestamp() };
    if (id) {
      await updateDoc(doc(konterFirestore, "konter_piutang", id), payload);
      return id;
    } else {
      payload.createdAt = serverTimestamp();
      const res = await addDoc(collection(konterFirestore, "konter_piutang"), payload);
      return res.id;
    }
  },

  async updatePiutangPayment(id: string, amountPaid: number, notes?: string): Promise<void> {
    const pRef = doc(konterFirestore, "konter_piutang", id);
    const snap = await getDoc(pRef);
    if (!snap.exists()) throw new Error("Data piutang tidak ditemukan");

    const curr = snap.data() as any;
    const totalRemaining = Math.max(0, (Number(curr.remainingAmount) || 0) - amountPaid);
    const history = curr.paymentHistory || [];

    history.push({
      amount: amountPaid,
      paidAt: new Date().toISOString(),
      notes: notes || "Pembayaran cicilan",
    });

    await updateDoc(pRef, {
      remainingAmount: totalRemaining,
      status: totalRemaining <= 0 ? "LUNAS" : "BELUM_LUNAS",
      paymentHistory: history,
      updatedAt: serverTimestamp(),
    });
  }
};

// ==========================================
// EXPORT ALIAS COMPATIBILITY LENGKAP
// ==========================================
export const supplierOperationalService = operationalService;
export const cashCountService = operationalService;
export const purchaseOrderService = operationalService;
export const poService = operationalService;
export const piutangService = operationalService;
export const apiService = operationalService;
export const wmsService = operationalService;
export const konterService = operationalService;
export default operationalService;