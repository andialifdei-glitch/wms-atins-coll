"use client";

import React, { useState, useEffect } from "react";
import { cashCountService } from "@/lib/operationalService";
import type { CashCountDocument, KonterPiutangItem, PiutangHistoryRecord } from "@/lib/types";
import jsPDF from "jspdf";
import "jspdf-autotable";


function generateCHDocNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(100 + Math.random() * 900);
  return `CH-${y}${m}${d}-${rand}`;
}
export default function KonterCashCountPage() {
  const [cashCounts, setCashCounts] = useState<CashCountDocument[]>([]);
  const [piutangList, setPiutangList] = useState<KonterPiutangItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Cash Count State
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashForm, setCashForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    cash: 0,
    bankMandiri: 0,
    bankBca: 0,
    bankBri: 0,
    seabank: 0,
    dana: 0,
    gopay: 0,
    sagaraMobile: 0,
    flip: 0,
  });

  // Modal Piutang State
  const [isPiutangModalOpen, setIsPiutangModalOpen] = useState(false);
  const [piutangForm, setPiutangForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    name: "",
    totalPiutang: 0,
    notes: ""
  });

  // Modal Pembayaran Piutang State
  const [payModal, setPayModal] = useState<{ show: boolean; piutang: KonterPiutangItem | null }>({ show: false, piutang: null });
  const [payAmount, setPayAmount] = useState(0);
  const [payNotes, setPayNotes] = useState("");

  // Modal History Piutang State
  const [historyModal, setHistoryModal] = useState<{ show: boolean; piutang: KonterPiutangItem | null }>({ show: false, piutang: null });

  // Confirm Submit Modal
  const [confirmSubmitModal, setConfirmSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [ccData, piuData] = await Promise.all([
        cashCountService.getCashCounts(),
        cashCountService.getPiutangList()
      ]);
      setCashCounts(ccData);
      setPiutangList(piuData);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  // Hitung total piutang aktif
  const totalActivePiutang = piutangList
    .filter(p => p.status === "AKTIF")
    .reduce((acc, curr) => acc + curr.remainingPiutang, 0);

  // Total dari semua field input termasuk piutang aktif
  const calculatedTotalCashCount = 
    Number(cashForm.cash) +
    Number(cashForm.bankMandiri) +
    Number(cashForm.bankBca) +
    Number(cashForm.bankBri) +
    Number(cashForm.seabank) +
    Number(cashForm.dana) +
    Number(cashForm.gopay) +
    Number(cashForm.sagaraMobile) +
    Number(cashForm.flip) +
    totalActivePiutang;

  function handlePreSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmSubmitModal(true);
  }

  async function executeConfirmedCashCount() {
    setConfirmSubmitModal(false);
    setSubmitting(true);
    setMsg(null);

    const dateObj = new Date(cashForm.date);
    const dayName = dateObj.toLocaleDateString("id-ID", { weekday: "long" });

    try {
      await cashCountService.saveCashCount({
          docNo: generateCHDocNo(),
        date: cashForm.date,
        dayName,
        cash: Number(cashForm.cash),
        bankMandiri: Number(cashForm.bankMandiri),
        bankBca: Number(cashForm.bankBca),
        bankBri: Number(cashForm.bankBri),
        seabank: Number(cashForm.seabank),
        dana: Number(cashForm.dana),
        gopay: Number(cashForm.gopay),
        sagaraMobile: Number(cashForm.sagaraMobile),
        flip: Number(cashForm.flip),
        piutangTotal: totalActivePiutang,
        totalCashCount: calculatedTotalCashCount,
        operatorName: "Admin Konter"
      });
      setMsg({ type: "success", text: "Cash Count berhasil disimpan." });
      setIsCashModalOpen(false);
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePiutang(e: React.FormEvent) {
    e.preventDefault();
    if (!piutangForm.name.trim() || piutangForm.totalPiutang <= 0) return;

    try {
      await cashCountService.savePiutang(piutangForm);
      setPiutangForm({ date: new Date().toISOString().slice(0, 10), name: "", totalPiutang: 0, notes: "" });
      await loadData();
    } catch (err: any) {
      alert("Gagal menyimpan piutang: " + err.message);
    }
  }

  async function handleExecutePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal.piutang || payAmount <= 0) return;

    try {
      await cashCountService.payPiutang(payModal.piutang.id!, payAmount, payNotes);
      setPayModal({ show: false, piutang: null });
      setPayAmount(0);
      setPayNotes("");
      await loadData();
    } catch (err: any) {
      alert("Gagal memproses pembayaran: " + err.message);
    }
  }

  // Ekspor PDF Dokumen Cash Count (File Download)
  function handleExportPdf(cc: CashCountDocument) {
    const doc = new jsPDF();
    doc.setFillColor(45, 18, 31);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("WMS Atin's Collection - Daily Cash Count Report", 14, 16);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`No Dokumen: ${cc.countNumber} | Hari/Tanggal: ${cc.dayName}, ${cc.date}`, 14, 32);

    const bodyData = [
      ["Cash", `Rp ${cc.cash.toLocaleString("id-ID")}`],
      ["Bank Mandiri", `Rp ${cc.bankMandiri.toLocaleString("id-ID")}`],
      ["Bank BCA", `Rp ${cc.bankBca.toLocaleString("id-ID")}`],
      ["Bank BRI", `Rp ${cc.bankBri.toLocaleString("id-ID")}`],
      ["Seabank", `Rp ${cc.seabank.toLocaleString("id-ID")}`],
      ["Dana", `Rp ${cc.dana.toLocaleString("id-ID")}`],
      ["Gopay", `Rp ${cc.gopay.toLocaleString("id-ID")}`],
      ["Sagara Mobile", `Rp ${cc.sagaraMobile.toLocaleString("id-ID")}`],
      ["Flip", `Rp ${cc.flip.toLocaleString("id-ID")}`],
      ["Piutang", `Rp ${cc.piutangTotal.toLocaleString("id-ID")}`],
    ];

    (doc as any).autoTable({
      startY: 38,
      head: [["Komponen", "Jumlah Nominal"]],
      body: bodyData,
      headStyles: { fillColor: [45, 18, 31], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setTextColor(45, 18, 31);
    doc.text(`Total Cash Count: Rp ${cc.totalCashCount.toLocaleString("id-ID")}`, 14, finalY);

    doc.save(`cashcount_${cc.countNumber}.pdf`);
  }

  // Share ke WhatsApp sesuai format permintaan persis
  function handleShareWhatsApp(cc: CashCountDocument) {
    const text = `Cash Count Hari ${cc.dayName} Tanggal ${cc.date}
No Dokumen : ${cc.countNumber}

Cash : Rp ${cc.cash.toLocaleString("id-ID")}
Bank Mandiri : Rp ${cc.bankMandiri.toLocaleString("id-ID")}
Bank BCA : Rp ${cc.bankBca.toLocaleString("id-ID")}
Bank BRI : Rp ${cc.bankBri.toLocaleString("id-ID")}
Seabank : Rp ${cc.seabank.toLocaleString("id-ID")}
Dana : Rp ${cc.dana.toLocaleString("id-ID")}
Gopay : Rp ${cc.gopay.toLocaleString("id-ID")}
Sagara Mobile : Rp ${cc.sagaraMobile.toLocaleString("id-ID")}
Flip : Rp ${cc.flip.toLocaleString("id-ID")}
Piutang : Rp ${cc.piutangTotal.toLocaleString("id-ID")}

Total Cash Count : Rp ${cc.totalCashCount.toLocaleString("id-ID")}`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Daily Cash Count &amp; Piutang</h1>
          <p className="text-xs text-slate-500">Rekonsiliasi kas harian, saldo bank/e-wallet, serta manajemen piutang operasional.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPiutangModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm transition"
          >
            Piutang
          </button>
          <button
            onClick={() => setIsCashModalOpen(true)}
            className="px-3.5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm transition"
          >
            Initialize Cash Count
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Tabel Riwayat Cash Count */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-rose-100 font-bold text-slate-900">Riwayat Dokumen Cash Count</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">No. Dokumen</th>
                <th className="p-3">Hari, Tanggal</th>
                <th className="p-3 text-right">Cash &amp; Bank</th>
                <th className="p-3 text-right">Piutang</th>
                <th className="p-3 text-right">Total Cash Count</th>
                <th className="p-3 text-center">Aksi (PDF &amp; WA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">Memuat data cash count...</td></tr>
              ) : cashCounts.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">Belum ada riwayat cash count.</td></tr>
              ) : (
                cashCounts.map(cc => (
                  <tr key={cc.id} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{cc.countNumber}</td>
                    <td className="p-3 font-medium">{cc.dayName}, {cc.date}</td>
                    <td className="p-3 text-right font-mono">Rp {(cc.totalCashCount - cc.piutangTotal).toLocaleString("id-ID")}</td>
                    <td className="p-3 text-right font-mono text-amber-700">Rp {cc.piutangTotal.toLocaleString("id-ID")}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">Rp {cc.totalCashCount.toLocaleString("id-ID")}</td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => handleExportPdf(cc)}
                        className="px-2.5 py-1 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded shadow-xs"
                      >
                        PDF File
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(cc)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs"
                      >
                        Share WA
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Initialize Cash Count */}
      {isCashModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-100 w-full max-w-xl p-5 text-slate-900 max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Initialize Daily Cash Count</h2>
            <form onSubmit={handlePreSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Tanggal <span className="text-rose-600">*</span></label>
                <input
                  type="date"
                  required
                  value={cashForm.date}
                  onChange={(e) => setCashForm({ ...cashForm, date: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cash", key: "cash" },
                  { label: "Bank Mandiri", key: "bankMandiri" },
                  { label: "Bank BCA", key: "bankBca" },
                  { label: "Bank BRI", key: "bankBri" },
                  { label: "Seabank", key: "seabank" },
                  { label: "Dana", key: "dana" },
                  { label: "Gopay", key: "gopay" },
                  { label: "Sagara Mobile", key: "sagaraMobile" },
                  { label: "Flip", key: "flip" },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block font-semibold mb-1">{field.label}</label>
                    <input
                      type="number"
                      min="0"
                      value={(cashForm as any)[field.key]}
                      onChange={(e) => setCashForm({ ...cashForm, [field.key]: Number(e.target.value) })}
                      className="w-full p-2 border rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                ))}

                <div>
                  <label className="block font-semibold mb-1">Piutang (Otomatis dari data piutang)</label>
                  <input
                    type="number"
                    disabled
                    value={totalActivePiutang}
                    className="w-full p-2 border rounded-lg font-mono font-bold bg-slate-100 text-amber-700"
                  />
                </div>
              </div>

              {/* Total dalam bentuk text */}
              <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg flex justify-between items-center">
                <span className="font-bold text-slate-900">Total Keseluruhan Cash Count:</span>
                <span className="font-mono font-bold text-sm text-[#BE185D]">
                  Rp {calculatedTotalCashCount.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-rose-100">
                <button
                  type="button"
                  onClick={() => setIsCashModalOpen(false)}
                  className="px-3.5 py-1.5 border rounded-lg font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Submit WMS */}
      {confirmSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-[#2D121F] w-full max-w-sm p-5 text-slate-900 space-y-3">
            <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
              <div className="w-3 h-3 rounded-full bg-[#BE185D]"></div>
              <h3 className="text-sm font-bold text-[#2D121F]">Konfirmasi Input Data</h3>
            </div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Apakah Anda yakin bahwa input data sudah benar?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmSubmitModal(false)}
                className="px-3.5 py-1.5 border rounded-lg font-semibold"
              >
                Belum
              </button>
              <button
                onClick={executeConfirmedCashCount}
                disabled={submitting}
                className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm"
              >
                {submitting ? "Memproses..." : "Sudah Benar (OK)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Piutang */}
      {isPiutangModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-100 w-full max-w-4xl p-6 text-slate-900 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-[#2D121F]">Manajemen Piutang</h2>
              <button onClick={() => setIsPiutangModalOpen(false)} className="px-3 py-1 bg-slate-200 rounded-lg font-bold">Tutup X</button>
            </div>

            {/* Form Input Piutang */}
            <form onSubmit={handleSavePiutang} className="p-4 bg-slate-50 border rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-900">+ Tambah Piutang Baru</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={piutangForm.date}
                    onChange={(e) => setPiutangForm({ ...piutangForm, date: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nama</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama peminjam..."
                    value={piutangForm.name}
                    onChange={(e) => setPiutangForm({ ...piutangForm, name: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Total Piutang</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={piutangForm.totalPiutang}
                    onChange={(e) => setPiutangForm({ ...piutangForm, totalPiutang: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg font-mono font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Keterangan</label>
                  <input
                    type="text"
                    placeholder="Keterangan..."
                    value={piutangForm.notes}
                    onChange={(e) => setPiutangForm({ ...piutangForm, notes: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-xs"
                >
                  Submit Piutang
                </button>
              </div>
            </form>

            {/* Tampilkan Dokumen Piutang & Tombol Aksi */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900">Daftar Dokumen Piutang</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b font-bold text-slate-700">
                      <th className="p-2.5">No. Piutang</th>
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5">Nama</th>
                      <th className="p-2.5 text-right">Total Piutang</th>
                      <th className="p-2.5 text-right">Sisa Piutang</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Aksi (History / Pembayaran / Tambah)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {piutangList.length === 0 ? (
                      <tr><td colSpan={7} className="p-5 text-center text-slate-400">Belum ada data piutang.</td></tr>
                    ) : (
                      piutangList.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-[#BE185D]">{p.piutangNumber}</td>
                          <td className="p-2.5 font-mono">{p.date}</td>
                          <td className="p-2.5 font-bold">{p.name}</td>
                          <td className="p-2.5 text-right font-mono">Rp {p.totalPiutang.toLocaleString("id-ID")}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-amber-700">Rp {p.remainingPiutang.toLocaleString("id-ID")}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === "AKTIF" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-center space-x-1">
                            <button
                              onClick={() => setHistoryModal({ show: true, piutang: p })}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-800 font-bold rounded text-white"
                            >
                              History
                            </button>
                            {p.status === "AKTIF" && (
                              <button
                                onClick={() => {
                                  setPayModal({ show: true, piutang: p });
                                  setPayAmount(p.remainingPiutang);
                                  setPayNotes("");
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 font-bold rounded text-white"
                              >
                                Pembayaran
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const add = prompt(`Tambahkan nominal piutang untuk ${p.name}:`, "0");
                                if (add && !isNaN(Number(add)) && Number(add) > 0) {
                                  alert(`Gunakan form tambah piutang baru di atas untuk membuat entry piutang baru.`);
                                }
                              }}
                              className="px-2 py-1 bg-[#BE185D] hover:bg-[#9D174D] font-bold rounded text-white"
                            >
                              Tambah Piutang
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembayaran Piutang */}
      {payModal.show && payModal.piutang && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-[#2D121F] w-full max-w-md p-5 text-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-[#2D121F]">Pembayaran Piutang: {payModal.piutang.name}</h3>
            <p className="text-xs text-slate-600">Sisa Piutang Saat Ini: <strong className="font-mono text-amber-700">Rp {payModal.piutang.remainingPiutang.toLocaleString("id-ID")}</strong></p>
            
            <form onSubmit={handleExecutePayment} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Nominal Pembayaran (Rp)</label>
                <input
                  type="number"
                  min="1"
                  max={payModal.piutang.remainingPiutang}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg font-mono font-bold text-slate-900 bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">*Bayar lunas atau sebagian (cicilan). Jika sisa piutang habis, status otomatis menjadi LUNAS/SELESAI.</p>
              </div>

              <div>
                <label className="block font-semibold mb-1">Keterangan / Catatan Pembayaran</label>
                <input
                  type="text"
                  placeholder="Catatan pembayaran..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModal({ show: false, piutang: null })}
                  className="px-3 py-1.5 border rounded-lg font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm"
                >
                  Konfirmasi Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal History Piutang */}
      {historyModal.show && historyModal.piutang && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-[#2D121F] w-full max-w-2xl p-5 text-slate-900 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-bold text-[#2D121F]">History Piutang: {historyModal.piutang.name} ({historyModal.piutang.piutangNumber})</h3>
              <button onClick={() => setHistoryModal({ show: false, piutang: null })} className="px-2.5 py-1 bg-slate-200 rounded font-bold">Tutup X</button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700">
                    <th className="p-2">Waktu</th>
                    <th className="p-2">Jenis Transaksi</th>
                    <th className="p-2 text-right">Bayar</th>
                    <th className="p-2 text-right">Sisa Sebelum</th>
                    <th className="p-2 text-right">Sisa Sesudah</th>
                    <th className="p-2">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(!historyModal.piutang.history || historyModal.piutang.history.length === 0) ? (
                    <tr><td colSpan={6} className="p-4 text-center text-slate-400">Belum ada riwayat transaksi piutang.</td></tr>
                  ) : (
                    historyModal.piutang.history.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 font-mono">{new Date(h.timestamp).toLocaleString("id-ID")}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${h.type === "PELUNASAN" ? "bg-emerald-100 text-emerald-900" : h.type === "PEMBAYARAN_SEBAGIAN" ? "bg-blue-100 text-blue-900" : "bg-purple-100 text-purple-900"}`}>
                            {h.type}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">Rp {h.amountPaid.toLocaleString("id-ID")}</td>
                        <td className="p-2 text-right font-mono">Rp {h.remainingBefore.toLocaleString("id-ID")}</td>
                        <td className="p-2 text-right font-mono font-bold text-amber-700">Rp {h.remainingAfter.toLocaleString("id-ID")}</td>
                        <td className="p-2 text-slate-600">{h.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}