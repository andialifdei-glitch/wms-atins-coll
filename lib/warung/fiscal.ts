import { warungFsFetch, warungDatastoreBase } from "@/lib/firebase-admin-warung";
import { getCoaMap } from "./coa";
import { postJournal } from "./journals";
import { computeIncomeStatement } from "./reports";

export const RETAINED_EARNINGS_CODE = "3-3001";
export const INCOME_SUMMARY_CODE = "3-3000";

export function periodIdFromDate(dateStr: string): string {
  return String(dateStr).slice(0, 7); // YYYY-MM
}

export function periodRangeFromId(periodId: string): { startDate: string; endDate: string } {
  const [y, m] = periodId.split("-");
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const startDate = `${y}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${y}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

/** Cek apakah tanggal masuk periode yang CLOSED */
export async function isDateLocked(dateStr: string): Promise<boolean> {
  const pid = periodIdFromDate(dateStr);
  const base = warungDatastoreBase();
  const res = await warungFsFetch(`${base}/warung_fiscal_periods/${encodeURIComponent(pid)}`);
  if (!res.ok) return false;
  const j: any = await res.json();
  return j.fields?.status?.stringValue === "CLOSED";
}

export interface ClosePeriodResult {
  periodId: string;
  netIncome: number;
  closingJournalId: string;
}

export async function closePeriod(periodId: string, actor: { uid: string; id: string; name: string; role: string }): Promise<ClosePeriodResult> {
  const base = warungDatastoreBase();
  const periodUrl = `${base}/warung_fiscal_periods/${encodeURIComponent(periodId)}`;
  const existing = await warungFsFetch(periodUrl);
  if (existing.ok) {
    const ej: any = await existing.json();
    if (ej.fields?.status?.stringValue === "CLOSED") throw new Error("Periode sudah CLOSED.");
  }

  const { startDate, endDate } = periodRangeFromId(periodId);

  // Ambil semua jurnal dalam periode
  const journalsRes = await warungFsFetch(`${base}/warung_journals?pageSize=1000`);
  if (!journalsRes.ok) throw new Error("Gagal baca jurnal.");
  const jj: any = await journalsRes.json();

  const coaMap = await getCoaMap();
  const bebanCodes = new Set<string>();
  const pendapatanCodes = new Set<string>();
  Object.keys(coaMap).forEach((code) => {
    if (coaMap[code].type === "BEBAN") bebanCodes.add(code);
    else if (coaMap[code].type === "PENDAPATAN") pendapatanCodes.add(code);
  });

  const acc: Record<string, number> = {};   // signed net (debit - credit)
  for (const d of (jj.documents || [])) {
    const f = d.fields || {};
    if (f.status?.stringValue !== "POSTED") continue;
    const date = f.journalDate?.stringValue || "";
    if (date < startDate || date > endDate) continue;
    const raw = f.entries?.arrayValue?.values || [];
    for (const v of raw) {
      const m = v.mapValue?.fields || {};
      const code = m.coaCode?.stringValue || "";
      const debit = parseInt(m.debit?.integerValue || "0", 10);
      const credit = parseInt(m.credit?.integerValue || "0", 10);
      if (!acc[code]) acc[code] = 0;
      acc[code] += (debit - credit);
    }
  }

  // Bangun closing entries
  const incomeStatement = await computeIncomeStatement(startDate, endDate);
  const closeEntries: Array<{ coaCode: string; coaName: string; debit: number; credit: number }> = [];

  // Tutup Pendapatan (saldo positif → DEBIT untuk nol-kan)
  for (const p of incomeStatement.pendapatan) {
    if (p.saldo > 0) closeEntries.push({ coaCode: p.coaCode, coaName: p.coaName, debit: p.saldo, credit: 0 });
  }
  // Tutup Beban (saldo positif → KREDIT untuk nol-kan)
  for (const b of incomeStatement.beban) {
    if (b.saldo > 0) closeEntries.push({ coaCode: b.coaCode, coaName: b.coaName, debit: 0, credit: b.saldo });
  }

  // Selisih → ke Laba Ditahan
  const netIncome = incomeStatement.labaBersih;
  if (!coaMap[RETAINED_EARNINGS_CODE]) throw new Error("Akun Laba Ditahan (3-3001) tidak ada.");

  if (netIncome > 0) {
    // Laba: DEBIT Ikhtisar Laba Rugi? Kita langsung ke Laba Ditahan
    // Agar balance: pendapatan - beban = laba. Setelah debit pendapatan & kredit beban, ada selisih credit → butuh debit ke Laba Ditahan? No:
    // Pendapatan sudah didebit penuh (mengurangi credit), beban sudah dikredit penuh (mengurangi debit).
    // Selisih: totalDebit (dari pendapatan ditutup) = totalPendapatan, totalCredit (dari beban) = totalBeban.
    // Selisih = totalPendapatan - totalBeban = laba. Debit - Credit = laba artinya debit lebih, tidak balance.
    // Jadi perlu KREDIT Laba Ditahan sebesar laba untuk balance.
    closeEntries.push({ coaCode: RETAINED_EARNINGS_CODE, coaName: coaMap[RETAINED_EARNINGS_CODE].coaName, debit: 0, credit: netIncome });
  } else if (netIncome < 0) {
    // Rugi: perlu DEBIT Laba Ditahan sebesar |laba|
    closeEntries.push({ coaCode: RETAINED_EARNINGS_CODE, coaName: coaMap[RETAINED_EARNINGS_CODE].coaName, debit: Math.abs(netIncome), credit: 0 });
  }

  // Posting jurnal penutup (kalau ada entry)
  let closingJournalId = "";
  if (closeEntries.length > 0) {
    const jr = await postJournal(closeEntries, {
      journalDate: endDate,
      description: `Closing Periode ${periodId}`,
      refType: "CLOSING",
      refId: periodId,
      actor,
    });
    closingJournalId = jr.journalId;
  }

  // Simpan/tandai periode CLOSED
  const nowIso = new Date().toISOString();
  const fields: any = {
    periodId: { stringValue: periodId },
    startDate: { stringValue: startDate },
    endDate: { stringValue: endDate },
    status: { stringValue: "CLOSED" },
    closedAt: { timestampValue: nowIso },
    closedBy: { stringValue: actor.id },
    netIncome: { integerValue: String(netIncome) },
    closingJournalId: { stringValue: closingJournalId },
  };
  const mask = "updateMask.fieldPaths=periodId&updateMask.fieldPaths=startDate&updateMask.fieldPaths=endDate&updateMask.fieldPaths=status&updateMask.fieldPaths=closedAt&updateMask.fieldPaths=closedBy&updateMask.fieldPaths=netIncome&updateMask.fieldPaths=closingJournalId";
  const res = await warungFsFetch(`${periodUrl}?${mask}`, { method: "PATCH", body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error("Gagal simpan periode CLOSED.");

  return { periodId, netIncome, closingJournalId };
}