import {
  ProdukKonter,
  TransaksiKonter,
  ProviderService,
  PelangganKonter,
  RekeningKas,
  PengeluaranOperasional,
  AuditLogKonter
} from "@/lib/types";

export const konterDb = {
  getAuditLog: (): AuditLogKonter[] => [],
  getPelanggan: (): PelangganKonter[] => [
    { id: "plg-1", nama: "Umum / Walk-in", noHp: "-", totalPiutang: 0 },
    { id: "plg-2", nama: "Pak RT 04", noHp: "081234567890", totalPiutang: 45000 }
  ],
  getKas: (): RekeningKas[] => [
    { id: "kas-1", nama: "Kas Laci Konter", saldo: 1250000 },
    { id: "kas-2", nama: "BCA Konter", saldo: 4500000 },
    { id: "kas-3", nama: "QRIS Kasir", saldo: 850000 }
  ],
  getTransaksi: (): TransaksiKonter[] => [],
  saveTransaksi: (_trx?: any): void => {},
  createTransaksi: (trx: any): any => ({ id: "TRX-" + Date.now(), ...trx }),
  getProduk: (): ProdukKonter[] => [],
  saveProduk: (_p?: any): void => {},
  getProviders: (): ProviderService[] => [
    { id: "prov-1", nama: "Digipos / Telkomsel", saldoTersedia: 450000 },
    { id: "prov-2", nama: "DANA Bisnis", saldoTersedia: 1200000 },
    { id: "prov-3", nama: "OVO Merchant", saldoTersedia: 300000 }
  ],
  getPengeluaran: (): PengeluaranOperasional[] => [],
  tambahPengeluaran: (_p?: any): void => {},
  adjustKas: (_sumberId: string, _nominal: number): void => {},
  updateSaldoProvider: (_id: string, _nom: number, _ket: string): void => {},
  adjustPiutang: (_pelId: string, _nom: number): void => {}
};