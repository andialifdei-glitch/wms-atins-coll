
function generatePrefixedDocCode(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${y}${m}${d}-${rand}`;
}


function generateCHNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `CH-${y}${m}${d}-${rand}`;
}


function generateCashCountNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CHC-${y}${m}${d}-${rand}`;
}

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
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { konterFirestore } from "./firebase";
import type { KonterProduct, KonterProductFamily } from "./types";

function generateDateDocCode(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export const operationalService = {

  async saveReceiving(rec: any): Promise<any> {
    const docNo = rec.receivingNumber || rec.rcvNumber || generatePrefixedDocCode("RCV");
    const payload = {
      ...rec,
      receivingNumber: docNo,
      rcvNumber: docNo,
      createdAt: serverTimestamp(),
    };
    const res = await addDoc(collection(konterFirestore, "konter_receivings"), payload);
    return { id: res.id, ...payload };
  },


  async saveCashCount(data: any): Promise<any> {
    try {
      const docNo = data.docNo || data.cashCountNumber || generateCHNumber();
      const payload = {
        ...data,
        docNo,
        cashCountNumber: docNo,
        createdAt: serverTimestamp(),
      };
      const res = await addDoc(collection(konterFirestore, "konter_cash_counts"), payload);
      return { id: res.id, ...payload };
    } catch (e) {
      console.warn("Gagal saveCashCount:", e);
      throw e;
    }
  },


  async getSales(startDate?: string, endDate?: string, limitCount = 500): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_sales"));
      let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      if (startDate || endDate) {
        list = list.filter((s: any) => {
          let sDateStr = "";
          if (s.date) {
            if (s.date.seconds) sDateStr = new Date(s.date.seconds * 1000).toISOString().slice(0, 10);
            else if (typeof s.date.toDate === "function") sDateStr = s.date.toDate().toISOString().slice(0, 10);
            else if (typeof s.date === "string") sDateStr = s.date.slice(0, 10);
          } else if (s.createdAt) {
            if (s.createdAt.seconds) sDateStr = new Date(s.createdAt.seconds * 1000).toISOString().slice(0, 10);
            else if (typeof s.createdAt === "string") sDateStr = s.createdAt.slice(0, 10);
          }
          if (!sDateStr) return false;
          if (startDate && sDateStr < startDate) return false;
          if (endDate && sDateStr > endDate) return false;
          return true;
        });
      }

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


  async getSuppliers(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_suppliers"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  },


  async getPiutangList(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_piutang"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  },


  async getCashCounts(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_cash_counts"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  },


  async getReceivings(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_receivings"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  },


  async getFamilies(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_families"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  },


  async getMovements(limitCount = 150): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_stock_movements"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      }).slice(0, limitCount);
    } catch (e) {
      console.warn("Gagal getMovements:", e);
      return [];
    }
  },


  async getAdjustments(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_stock_adjustments"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
    } catch (e) {
      console.warn("Gagal getAdjustments:", e);
      return [];
    }
  },

  async getProducts(): Promise<KonterProduct[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_products"));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    } catch (e) {
      return [];
    }
  },

  async getPurchaseOrders(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_purchase_orders"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      return [];
    }
  },

  async createPurchaseOrder(po: any): Promise<any> {
    const docNo = po.orderNumber || po.poNumber || generatePrefixedDocCode("PO");
    const payload = {
      ...po,
      orderNumber: docNo,
      poNumber: docNo,
      status: po.status || "PENDING",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(konterFirestore, "konter_purchase_orders"), payload);
    return { id: ref.id, ...payload };
  },

  // Perbaikan error cancelPurchaseOrder is not a function
  async cancelPurchaseOrder(id: string, reason?: string): Promise<void> {
    const poRef = doc(konterFirestore, "konter_purchase_orders", id);
    await updateDoc(poRef, {
      status: "CANCELLED",
      cancelReason: reason || "Dibatalkan oleh operator",
      updatedAt: serverTimestamp(),
    });
  },

  async getInternalPurchases(limitCount = 100): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_internal_purchases"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      }).slice(0, limitCount);
    } catch (e) {
      return [];
    }
  },

  async processInternalPurchase(params: any): Promise<string> {
    const batch = writeBatch(konterFirestore);
    const docNo = generatePrefixedDocCode("IP");
    const sourceRef = doc(konterFirestore, "konter_products", params.sourceProduct.id);
    const newSourceStock = Math.max(0, (params.sourceProduct.currentStock || 0) - params.qtySource);
    batch.update(sourceRef, { currentStock: newSourceStock, updatedAt: serverTimestamp() });

    const targetRef = doc(konterFirestore, "konter_products", params.targetProduct.id);
    const newTargetStock = (params.targetProduct.currentStock || 0) + params.qtyTarget;
    batch.update(targetRef, {
      currentStock: newTargetStock,
      sellingPrice: Number(params.sellingPriceTarget) || 0,
      capitalPrice: Number(params.capitalPriceTarget) || 0,
      updatedAt: serverTimestamp(),
    });

    const ipRef = doc(collection(konterFirestore, "konter_internal_purchases"));
    batch.set(ipRef, {
      docNo,
      ...params,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return docNo;
  },

  async getStockOpnameList(): Promise<any[]> {
    try {
      const snap = await getDocs(collection(konterFirestore, "konter_stock_opnames"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (e) {
      return [];
    }
  },

  // SOP baru dengan status OPEN (khusus produk fisik)
  async initializeStockOpname(params?: { notes?: string; initiatedBy?: string }): Promise<any> {
    const prodSnap = await getDocs(collection(konterFirestore, "konter_products"));
    const physicalProducts = prodSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((p: any) => {
        const typeStr = ((p.type || p.category || p.stockCategory || p.productCategory || "") + "").toLowerCase();
        const nameStr = ((p.name || "") + "").toLowerCase();
        const isJasa = typeStr.includes("jasa") || typeStr.includes("service") || typeStr.includes("fee") || nameStr.startsWith("jasa ") || nameStr.startsWith("servis ");
        return !isJasa;
      });

    const sopDocNo = generatePrefixedDocCode("SOP");
    const items = physicalProducts.map((p: any) => ({
      productId: p.id,
      sku: p.sku || "",
      productName: p.name || "",
      systemStock: Number(p.currentStock) || 0,
      physicalStock: null,
      difference: 0,
      capitalPrice: Number(p.capitalPrice) || 0,
      varianceValue: 0,
      counted: false,
    }));

    const payload = {
      sopNumber: sopDocNo,
      status: "OPEN", // Status awal OPEN
      totalItems: items.length,
      items,
      notes: params?.notes || "Inisialisasi Stock Opname Produk Fisik",
      initiatedBy: params?.initiatedBy || "Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(konterFirestore, "konter_stock_opnames"), payload);
    return { id: docRef.id, ...payload };
  },

  // Update snapshot dengan status COUNTED atau READY
  async updateStockOpnameSnapshot(id: string, items: any[], status = "COUNTED"): Promise<void> {
    const sopRef = doc(konterFirestore, "konter_stock_opnames", id);
    const calculatedItems = items.map((it) => {
      const sys = Number(it.systemStock) || 0;
      const phys = it.physicalStock !== null && it.physicalStock !== undefined ? Number(it.physicalStock) : sys;
      const diff = phys - sys;
      const cap = Number(it.capitalPrice) || 0;
      return {
        ...it,
        physicalStock: phys,
        difference: diff,
        varianceValue: diff * cap,
        counted: true,
      };
    });

    await updateDoc(sopRef, {
      items: calculatedItems,
      status: status, // Bisa COUNTED atau READY
      updatedAt: serverTimestamp(),
    });
  },

  // Batalkan SOP dengan status OPEN beserta alasannya
  async cancelStockOpname(id: string, reason: string): Promise<void> {
    const sopRef = doc(konterFirestore, "konter_stock_opnames", id);
    const sopSnap = await getDoc(sopRef);
    if (!sopSnap.exists()) throw new Error("Dokumen SOP tidak ditemukan");
    const data = sopSnap.data();
    if (data.status !== "OPEN") throw new Error("Hanya SOP dengan status OPEN yang dapat dibatalkan");

    await updateDoc(sopRef, {
      status: "CANCELLED",
      cancelReason: reason,
      updatedAt: serverTimestamp(),
    });
  },

  // Posting SOP menjadi POSTED
  async postStockOpname(id: string, reviewedBy?: string): Promise<string> {
    const sopRef = doc(konterFirestore, "konter_stock_opnames", id);
    const sopSnap = await getDoc(sopRef);
    if (!sopSnap.exists()) throw new Error("Dokumen SOP tidak ditemukan");

    const sopData = sopSnap.data() as any;
    if (sopData.status === "POSTED") throw new Error("Dokumen SOP ini sudah pernah di-posting!");

    const postDocNo = generatePrefixedDocCode("POST");
    const batch = writeBatch(konterFirestore);
    const nowStr = new Date().toISOString();

    for (const item of sopData.items || []) {
      const physStock = item.physicalStock !== null && item.physicalStock !== undefined ? Number(item.physicalStock) : Number(item.systemStock || 0);
      const sysStock = Number(item.systemStock) || 0;
      const diff = physStock - sysStock;

      const prodRef = doc(konterFirestore, "konter_products", item.productId);
      batch.update(prodRef, { currentStock: physStock, updatedAt: serverTimestamp() });

      if (diff !== 0) {
        const moveRef = doc(collection(konterFirestore, "konter_stock_movements"));
        batch.set(moveRef, {
          refCode: postDocNo,
          sku: item.sku || "",
          productName: item.productName || "",
          type: diff > 0 ? "IN_OPNAME" : "OUT_OPNAME",
          qty: Math.abs(diff),
          balanceBefore: sysStock,
          balanceAfter: physStock,
          notes: `Posting Opname ${sopData.sopNumber}`,
          createdAt: serverTimestamp(),
        });
      }
    }

    batch.update(sopRef, {
      status: "POSTED",
      postingDocNo: postDocNo,
      postedBy: reviewedBy || "Admin",
      postedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return postDocNo;
  }
};

export const supplierOperationalService = operationalService;
export const cashCountService = operationalService;
export const purchaseOrderService = operationalService;
export const poService = operationalService;
export default operationalService;