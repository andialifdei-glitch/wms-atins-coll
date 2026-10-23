export interface KonterProductFamily {
  id?: string;
  code: string; // FAM-xxx
  name: string;
  description?: string;
  createdAt: string;
}

export interface KonterProduct {
  id?: string;
  familyCode: string;
  sku: string; // SKU-xxx
  name: string;
  stockCategory: "FISIK" | "JASA";
  productCategory: string;
  unit: string;
  capitalPrice: number;
  sellingPrice: number;
  status: "AKTIF" | "NONAKTIF";
  notes?: string;
  currentStock: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockMovement {
  id?: string;
  timestamp: string;
  productSku: string;
  productName: string;
  type: "STOCK_MASUK" | "STOCK_KELUAR" | "ADJUSTMENT" | "RECEIVING" | "RESET_JASA";
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  referenceDoc: string;
  operatorName: string;
  notes?: string;
}

export interface StockAdjustment {
  id?: string;
  adjustmentNumber: string; // ADJ-xxx
  timestamp: string;
  productSku: string;
  productName: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  reason: string;
  operatorName: string;
}

export interface PurchaseOrderItem {
  sku: string;
  name: string;
  quantity: number;
  receivedQuantity: number;
  capitalPrice: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id?: string;
  poNumber: string; // PO-xxx
  supplierName: string;
  orderDate: string;
  items: PurchaseOrderItem[];
  status: "OPEN" | "PARTIALLY_RECEIVED" | "COMPLETED" | "CANCELLED";
  totalAmount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReceivingItem {
  sku: string;
  name: string;
  receivedQty: number;
  capitalPrice: number;
}

export interface ReceivingDocument {
  id?: string;
  rcvNumber: string; // RCV-xxx
  poId: string;
  poNumber: string;
  supplierName: string;
  receivedDate: string;
  items: ReceivingItem[];
  operatorName: string;
  notes?: string;
  createdAt: string;
}

export interface KonterSaleTransaction {
  id?: string;
  transactionNumber: string;
  sourceId?: string;
  date: string;
  productSku: string;
  productName: string;
  category: string;
  quantity: number;
  price: number;
  totalOmzet: number;
  grossProfit: number;
  operatorName: string;
  notes?: string;
  createdAt: string;
}

export interface KonterSupplier {
  id?: string;
  supplierCode: string; // SUPP-xxx
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PiutangHistoryRecord {
  timestamp: string;
  type: "PEMBAYARAN_SEBAGIAN" | "PELUNASAN" | "PEMBUATAN";
  amountPaid: number;
  remainingBefore: number;
  remainingAfter: number;
  notes: string;
}

export interface KonterPiutangItem {
  id?: string;
  piutangNumber: string; // PIU-xxx
  date: string;
  name: string;
  totalPiutang: number;
  remainingPiutang: number;
  notes: string;
  status: "AKTIF" | "SELESAI";
  history: PiutangHistoryRecord[];
  createdAt: string;
}

export interface CashCountDocument {
  id?: string;
  countNumber: string; // CHC-YYYYMMDD-xxx
  date: string;
  dayName: string;
  cash: number;
  bankMandiri: number;
  bankBca: number;
  bankBri: number;
  seabank: number;
  dana: number;
  gopay: number;
  sagaraMobile: number;
  flip: number;
  piutangTotal: number;
  totalCashCount: number;
  operatorName: string;
  createdAt: string;
}





// ==========================================
// OPERASIONAL & KONTER UNIFIED INTERFACES
// ==========================================
export interface ProviderService {
  id: string;
  nama: string;
  kode?: string;
  kodeProvider?: string;
  kategori?: string;
  saldoTersedia: number;
  statusAktif?: boolean;
}

export interface PelangganKonter {
  id: string;
  nama: string;
  noHp?: string;
  totalPiutang: number;
  catatan?: string;
  createdAt?: string;
}

export interface RekeningKas {
  id: string;
  nama?: string;
  namaAkun?: string;
  tipe?: string;
  saldo: number;
  nomorRekening?: string;
  atasNama?: string;
}

export interface PengeluaranOperasional {
  id: string;
  tanggal: string;
  kategori: string;
  nominal: number;
  keterangan: string;
  sumberKasId: string;
}

export interface AuditLogKonter {
  id: string;
  timestamp: string;
  user?: string;
  aktor?: string;
  action?: string;
  aksi?: string;
  details?: string;
  detail?: string;
}

export interface MutasiSaldoProvider {
  saldoAwal?: number;
  id: string;
  providerId: string;
  tanggal: string;
  nominal: number;
  keterangan: string;
  saldoAkhir: number;
  tipe?: string;
}

export interface ProdukKonter {
  id: string;
  kode?: string;
  kodeProduk?: string;
  nama?: string;
  namaProduk?: string;
  kategori: string;
  tipe?: string;
  provider?: string;
  providerId?: string;
  hargaBeli: number;
  hargaJual: number;
  laba?: number;
  stok?: number;
  stokFisik?: number;
  status?: string;
  statusAktif?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransaksiKonter {
  sisaPiutang?: number;
  id: string;
  nomorTransaksi?: string;
  tanggal?: string;
  produkId?: string;
  namaProduk?: string;
  kategori?: string;
  noTujuan?: string;
  namaPelanggan?: string;
  pelangganId?: string;
  hargaBeli: number;
  hargaJual: number;
  laba: number;
  metodePembayaran: string;
  sumberKasId?: string;
  status: string;
  snProvider?: string;
  jumlahBayar?: number;
  createdAt?: string;
}

export interface KonterPurchaseOrderItem {
  sku: string;
  name: string;
  qty: number;
  quantity?: number;
  receivedQuantity?: number;
  unitPrice: number;
  capitalPrice?: number;
  subtotal: number;
}

export interface KonterPurchaseOrder {
  id?: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDate?: string;
  items: KonterPurchaseOrderItem[];
  totalAmount: number;
  status: "DRAFT" | "SUBMITTED" | "RECEIVED" | "CANCELLED" | "OPEN" | "PARTIALLY_RECEIVED";
  notes?: string;
  cancelReason?: string;
  cancelledBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface KonterReceivingItem {
  sku: string;
  name: string;
  qtyReceived: number;
  unitPrice: number;
  subtotal: number;
}

export interface KonterReceiving {
  id?: string;
  rcvNumber?: string;
  receivingNumber?: string;
  poId?: string;
  poNumber?: string;
  supplierId: string;
  supplierName: string;
  receivingDate?: string;
  receivedDate?: string;
  operatorName?: string;
  items: KonterReceivingItem[];
  totalAmount: number;
  notes?: string;
  receivedBy?: string;
  createdAt?: any;
}

export interface KonterDailySales {
  id?: string;
  date: string;
  totalSales: number;
  totalCash: number;
  totalTransfer: number;
  totalQris: number;
  totalPiutang: number;
  itemsCount: number;
  notes?: string;
  createdAt?: any;
}

export interface KonterDailyCashCount {
  id?: string;
  date: string;
  expectedCash: number;
  actualCash: number;
  difference: number;
  countedBy: string;
  notes?: string;
  createdAt?: any;
}

export interface KonterPiutang {
  id?: string;
  customerId: string;
  customerName: string;
  phoneNumber?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  dueDate?: string;
  notes?: string;
  createdAt?: any;
}
