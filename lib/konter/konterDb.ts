import {
  ProdukKonter,
  ProviderService,
  TransaksiKonter,
  PelangganKonter,
  RekeningKas,
  PengeluaranOperasional,
  AuditLogKonter,
  MutasiSaldoProvider
} from "@/lib/types";

// Inisialisasi Master Data Default Awal (Konter & PPOB)
let providersStore: ProviderService[] = [
  { id: "prov-1", nama: "Digiflazz", kodeProvider: "DIGI", saldoTersedia: 1500000, statusAktif: true },
  { id: "prov-2", nama: "VIP Reseller", kodeProvider: "VIP", saldoTersedia: 750000, statusAktif: true },
  { id: "prov-3", nama: "Kioser Direct", kodeProvider: "KIOS", saldoTersedia: 320000, statusAktif: true },
];

let produkStore: ProdukKonter[] = [
  { id: "prd-1", kodeProduk: "TLK5", namaProduk: "Telkomsel 5.000 Reguler", tipe: "DIGITAL_PPOB", kategori: "PULSA", providerId: "prov-1", hargaBeli: 5250, hargaJual: 7000, statusAktif: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "prd-2", kodeProduk: "TLK10", namaProduk: "Telkomsel 10.000 Reguler", tipe: "DIGITAL_PPOB", kategori: "PULSA", providerId: "prov-1", hargaBeli: 10250, hargaJual: 12000, statusAktif: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "prd-3", kodeProduk: "PLN20", namaProduk: "Token PLN 20.000", tipe: "DIGITAL_PPOB", kategori: "TOKEN_PLN", providerId: "prov-1", hargaBeli: 20100, hargaJual: 22500, statusAktif: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "prd-4", kodeProduk: "DANA50", namaProduk: "Topup DANA 50.000", tipe: "DIGITAL_PPOB", kategori: "E_WALLET", providerId: "prov-2", hargaBeli: 50300, hargaJual: 52500, statusAktif: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "prd-5", kodeProduk: "ACC-CHG1", namaProduk: "Kabel Data Type-C Fast 66W", tipe: "FISIK", kategori: "LAINNYA", hargaBeli: 15000, hargaJual: 25000, stokFisik: 18, statusAktif: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

let pelangganStore: PelangganKonter[] = [
  { id: "cust-1", nama: "Pelanggan Umum (Cash)", noHp: "08000000000", totalPiutang: 0, createdAt: new Date().toISOString() },
  { id: "cust-2", nama: "Pak RT Bambang", noHp: "081234567890", totalPiutang: 34500, catatan: "Sering titip pulsa bulanan", createdAt: new Date().toISOString() },
];

let kasStore: RekeningKas[] = [
  { id: "kas-1", namaAkun: "Kas Laci Kasir", tipe: "KAS_TUNAI", saldo: 850000 },
  { id: "kas-2", namaAkun: "Bank BCA Operasional", tipe: "BANK", saldo: 4200000, nomorRekening: "8720192831", atasNama: "Konter Emir" },
  { id: "kas-3", namaAkun: "QRIS Merchant", tipe: "E_WALLET", saldo: 650000 },
];

let transaksiStore: TransaksiKonter[] = [];
let mutasiStore: MutasiSaldoProvider[] = [];
let pengeluaranStore: PengeluaranOperasional[] = [];
let auditStore: AuditLogKonter[] = [];

export const konterDb = {
  // Master Produk
  getProduk: () => [...produkStore],
  saveProduk: (item: Omit<ProdukKonter, "id" | "createdAt" | "updatedAt">) => {
    const newId = `prd-${Date.now()}`;
    const now = new Date().toISOString();
    const created: ProdukKonter = { ...item, id: newId, createdAt: now, updatedAt: now };
    produkStore.unshift(created);
    return created;
  },
  updateProduk: (id: string, item: Partial<ProdukKonter>) => {
    produkStore = produkStore.map(p => p.id === id ? { ...p, ...item, updatedAt: new Date().toISOString() } : p);
    return produkStore.find(p => p.id === id);
  },

  // Master Provider
  getProviders: () => [...providersStore],
  updateSaldoProvider: (providerId: string, nominalDiff: number, keterangan: string) => {
    const prov = providersStore.find(p => p.id === providerId);
    if (!prov) throw new Error("Provider tidak ditemukan");
    const awal = prov.saldoTersedia;
    prov.saldoTersedia += nominalDiff;
    const mutasi: MutasiSaldoProvider = {
      id: `mut-${Date.now()}`,
      providerId,
      tanggal: new Date().toISOString(),
      tipe: nominalDiff >= 0 ? "DEPOSIT" : "POTONG_TRANSAKSI",
      nominal: Math.abs(nominalDiff),
      saldoAwal: awal,
      saldoAkhir: prov.saldoTersedia,
      keterangan
    };
    mutasiStore.unshift(mutasi);
    return prov;
  },

  // Master Kas & Rekening
  getKas: () => [...kasStore],
  adjustKas: (kasId: string, nominalDiff: number) => {
    const k = kasStore.find(x => x.id === kasId);
    if (k) k.saldo += nominalDiff;
    return k;
  },

  // Pelanggan & Piutang
  getPelanggan: () => [...pelangganStore],
  tambahPelanggan: (nama: string, noHp: string, catatan?: string) => {
    const p: PelangganKonter = { id: `cust-${Date.now()}`, nama, noHp, totalPiutang: 0, catatan, createdAt: new Date().toISOString() };
    pelangganStore.push(p);
    return p;
  },
  adjustPiutang: (pelangganId: string, diff: number) => {
    const c = pelangganStore.find(x => x.id === pelangganId);
    if (c) c.totalPiutang += diff;
    return c;
  },

  // Transaksi PPOB & Penjualan (Atomic Transaction Handling)
  getTransaksi: () => [...transaksiStore],
  createTransaksi: (payload: {
    namaPelanggan: string;
    pelangganId?: string;
    noTujuan: string;
    produkId: string;
    metodePembayaran: "CASH" | "TRANSFER" | "PIUTANG" | "QRIS";
    kasId?: string;
    snProvider?: string;
  }) => {
    const produk = produkStore.find(p => p.id === payload.produkId);
    if (!produk) throw new Error("Produk tidak ditemukan");

    // Jika produk fisik, kurangi stok fisik
    if (produk.tipe === "FISIK") {
      if ((produk.stokFisik ?? 0) < 1) throw new Error("Stok fisik produk telah habis");
      produk.stokFisik = (produk.stokFisik ?? 1) - 1;
    }

    // Jika PPOB Digital, potong saldo deposit provider
    if (produk.tipe === "DIGITAL_PPOB" && produk.providerId) {
      const prov = providersStore.find(pr => pr.id === produk.providerId);
      if (prov && prov.saldoTersedia < produk.hargaBeli) {
        throw new Error(`Saldo provider ${prov.nama} tidak mencukupi untuk memproses order ini`);
      }
      if (prov) {
        konterDb.updateSaldoProvider(prov.id, -produk.hargaBeli, `Transaksi ${produk.namaProduk} ke ${payload.noTujuan}`);
      }
    }

    const laba = produk.hargaJual - produk.hargaBeli;
    const isPiutang = payload.metodePembayaran === "PIUTANG";
    const sisaPiutang = isPiutang ? produk.hargaJual : 0;

    // Catat ke Kas jika bukan full piutang
    if (!isPiutang && payload.kasId) {
      konterDb.adjustKas(payload.kasId, produk.hargaJual);
    }

    // Catat penambahan piutang pelanggan jika tempo/bon
    if (isPiutang && payload.pelangganId) {
      konterDb.adjustPiutang(payload.pelangganId, produk.hargaJual);
    }

    const t: TransaksiKonter = {
      id: `trx-${Date.now()}`,
      nomorTransaksi: `TRK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      tanggal: new Date().toISOString(),
      pelangganId: payload.pelangganId,
      namaPelanggan: payload.namaPelanggan || "Umum",
      noTujuan: payload.noTujuan,
      produkId: produk.id,
      namaProduk: produk.namaProduk,
      kategori: produk.kategori,
      hargaBeli: produk.hargaBeli,
      hargaJual: produk.hargaJual,
      laba,
      status: "SUCCESS",
      metodePembayaran: payload.metodePembayaran,
      jumlahBayar: isPiutang ? 0 : produk.hargaJual,
      sisaPiutang,
      snProvider: payload.snProvider || `SN${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      createdAt: new Date().toISOString()
    };

    transaksiStore.unshift(t);

    // Audit log
    auditStore.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      aktor: "Kasir Konter",
      aksi: "TRANSAKSI_BARU",
      detail: `Nomor: ${t.nomorTransaksi}, Produk: ${t.namaProduk}, Total: Rp ${t.hargaJual.toLocaleString("id-ID")}`
    });

    return t;
  },

  // Pengeluaran Operasional
  getPengeluaran: () => [...pengeluaranStore],
  tambahPengeluaran: (data: Omit<PengeluaranOperasional, "id">) => {
    const item: PengeluaranOperasional = { ...data, id: `exp-${Date.now()}` };
    pengeluaranStore.unshift(item);
    konterDb.adjustKas(data.sumberKasId, -data.nominal);
    return item;
  },

  // Audit Log
  getAuditLog: () => [...auditStore]
};
