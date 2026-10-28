import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { getCoaMap, type CoaRow } from "./coa";

export interface JournalEntryRaw { coaCode: string; coaName: string; debit: number; credit: number; }
export interface JournalRaw { journalId: string; journalDate: string; status: string; entries: JournalEntryRaw[]; }

function docToJournal(d: any): JournalRaw {
  const f = d.fields || {};
  const raw = f.entries?.arrayValue?.values || [];
  const entries: JournalEntryRaw[] = raw.map((v: any) => {
    const m = v.mapValue?.fields || {};
    return {
      coaCode: m.coaCode?.stringValue || "",
      coaName: m.coaName?.stringValue || "",
      debit: parseInt(m.debit?.integerValue || "0", 10),
      credit: parseInt(m.credit?.integerValue || "0", 10),
    };
  });
  return {
    journalId: f.journalId?.stringValue || d.name.split("/").pop(),
    journalDate: f.journalDate?.stringValue || "",
    status: f.status?.stringValue || "POSTED",
    entries,
  };
}

export async function getAllJournals(): Promise<JournalRaw[]> {
  const res = await warungFsFetch(`${warungDatastoreBase()}/warung_journals?pageSize=1000`);
  if (!res.ok) return [];
  const j: any = await res.json();
  return (j.documents || []).map(docToJournal).filter((x: JournalRaw) => x.status === "POSTED");
}

export interface SaldoRow { coaCode: string; coaName: string; type: string; normalBalance: string; debit: number; credit: number; saldo: number; }
export type TrialBalance = { rows: SaldoRow[]; totalDebit: number; totalCredit: number; };

export async function computeTrialBalance(asOfDate?: string): Promise<TrialBalance> {
  const coaMap = await getCoaMap();
  const journals = await getAllJournals();
  const acc: Record<string, { debit: number; credit: number }> = {};

  for (const j of journals) {
    if (asOfDate && j.journalDate > asOfDate) continue;
    for (const e of j.entries) {
      if (!acc[e.coaCode]) acc[e.coaCode] = { debit: 0, credit: 0 };
      acc[e.coaCode].debit += e.debit;
      acc[e.coaCode].credit += e.credit;
    }
  }

  const rows: SaldoRow[] = Object.keys(coaMap).map((code) => {
    const coa: CoaRow = coaMap[code];
    const a = acc[code] || { debit: 0, credit: 0 };
    const saldo = a.debit - a.credit;
    return {
      coaCode: code,
      coaName: coa.coaName,
      type: coa.type,
      normalBalance: coa.normalBalance,
      debit: a.debit,
      credit: a.credit,
      saldo,
    };
  }).filter((r) => r.debit !== 0 || r.credit !== 0);

  rows.sort((a, b) => a.coaCode.localeCompare(b.coaCode));
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit, totalCredit };
}

export interface IncomeStatement {
  periodStart: string;
  periodEnd: string;
  pendapatan: SaldoRow[];
  totalPendapatan: number;
  beban: SaldoRow[];
  totalBeban: number;
  labaBersih: number;
}

export async function computeIncomeStatement(periodStart: string, periodEnd: string): Promise<IncomeStatement> {
  const coaMap = await getCoaMap();
  const journals = await getAllJournals();
  const acc: Record<string, { debit: number; credit: number }> = {};

  for (const j of journals) {
    if (j.journalDate < periodStart || j.journalDate > periodEnd) continue;
    for (const e of j.entries) {
      if (!acc[e.coaCode]) acc[e.coaCode] = { debit: 0, credit: 0 };
      acc[e.coaCode].debit += e.debit;
      acc[e.coaCode].credit += e.credit;
    }
  }

  const pendapatan: SaldoRow[] = [];
  const beban: SaldoRow[] = [];
  let totalPendapatan = 0;
  let totalBeban = 0;

  Object.keys(coaMap).forEach((code) => {
    const coa = coaMap[code];
    const a = acc[code];
    if (!a) return;
    if (coa.type === "PENDAPATAN") {
      const saldo = a.credit - a.debit;
      if (saldo !== 0) {
        pendapatan.push({ coaCode: code, coaName: coa.coaName, type: coa.type, normalBalance: coa.normalBalance, debit: a.debit, credit: a.credit, saldo });
        totalPendapatan += saldo;
      }
    } else if (coa.type === "BEBAN") {
      const saldo = a.debit - a.credit;
      if (saldo !== 0) {
        beban.push({ coaCode: code, coaName: coa.coaName, type: coa.type, normalBalance: coa.normalBalance, debit: a.debit, credit: a.credit, saldo });
        totalBeban += saldo;
      }
    }
  });

  pendapatan.sort((x, y) => x.coaCode.localeCompare(y.coaCode));
  beban.sort((x, y) => x.coaCode.localeCompare(y.coaCode));

  return {
    periodStart,
    periodEnd,
    pendapatan,
    totalPendapatan,
    beban,
    totalBeban,
    labaBersih: totalPendapatan - totalBeban,
  };
}

export interface BalanceSheet {
  asOfDate: string;
  aset: SaldoRow[];
  totalAset: number;
  kewajiban: SaldoRow[];
  totalKewajiban: number;
  ekuitas: SaldoRow[];
  totalEkuitas: number;
  labaBerjalan: number;
  totalAsetCheck: number;    // totalAset
  totalPasivaCheck: number;  // totalKewajiban + totalEkuitas + labaBerjalan
}

export async function computeBalanceSheet(asOfDate: string): Promise<BalanceSheet> {
  const coaMap = await getCoaMap();
  const journals = await getAllJournals();
  const acc: Record<string, { debit: number; credit: number }> = {};

  for (const j of journals) {
    if (asOfDate && j.journalDate > asOfDate) continue;
    for (const e of j.entries) {
      if (!acc[e.coaCode]) acc[e.coaCode] = { debit: 0, credit: 0 };
      acc[e.coaCode].debit += e.debit;
      acc[e.coaCode].credit += e.credit;
    }
  }

  const aset: SaldoRow[] = [];
  const kewajiban: SaldoRow[] = [];
  const ekuitas: SaldoRow[] = [];
  let totalAset = 0;
  let totalKewajiban = 0;
  let totalEkuitas = 0;
  let totalPendapatan = 0;
  let totalBeban = 0;

  Object.keys(coaMap).forEach((code) => {
    const coa = coaMap[code];
    const a = acc[code];
    if (!a) return;
    const net = a.debit - a.credit;

    if (coa.type === "ASET") {
      if (net !== 0) {
        aset.push({ coaCode: code, coaName: coa.coaName, type: coa.type, normalBalance: coa.normalBalance, debit: a.debit, credit: a.credit, saldo: net });
        totalAset += net;
      }
    } else if (coa.type === "KEWAJIBAN") {
      if (net !== 0) {
        const saldo = -net;
        kewajiban.push({ coaCode: code, coaName: coa.coaName, type: coa.type, normalBalance: coa.normalBalance, debit: a.debit, credit: a.credit, saldo });
        totalKewajiban += saldo;
      }
    } else if (coa.type === "EKUITAS") {
      if (net !== 0) {
        const saldo = -net;
        ekuitas.push({ coaCode: code, coaName: coa.coaName, type: coa.type, normalBalance: coa.normalBalance, debit: a.debit, credit: a.credit, saldo });
        totalEkuitas += saldo;
      }
    } else if (coa.type === "PENDAPATAN") {
      totalPendapatan += (a.credit - a.debit);
    } else if (coa.type === "BEBAN") {
      totalBeban += (a.debit - a.credit);
    }
  });

  aset.sort((x, y) => x.coaCode.localeCompare(y.coaCode));
  kewajiban.sort((x, y) => x.coaCode.localeCompare(y.coaCode));
  ekuitas.sort((x, y) => x.coaCode.localeCompare(y.coaCode));

  const labaBerjalan = totalPendapatan - totalBeban;
  const totalPasiva = totalKewajiban + totalEkuitas + labaBerjalan;

  return {
    asOfDate,
    aset,
    totalAset,
    kewajiban,
    totalKewajiban,
    ekuitas,
    totalEkuitas,
    labaBerjalan,
    totalAsetCheck: totalAset,
    totalPasivaCheck: totalPasiva,
  };
}