"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import jsPDF from "jspdf";


export default function StockOpnamePage() {
  const [opnameList, setOpnameList] = useState<any[]>([]);
  const [selectedOpname, setSelectedOpname] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [notesInput, setNotesInput] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await operationalService.getStockOpnameList();
      setOpnameList(data || []);
    } catch (err: any) {
      alert("Gagal memuat daftar Stock Opname: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // 1. Initialize SOP (Format SOP-YYYYMMDD-xxx, Khusus Produk Fisik, Tanpa Produk Jasa)
  async function handleInitialize() {
    if (!window.confirm("Inisialisasi dokumen Stock Opname baru?\n\nHanya PRODUK FISIK yang akan dimasukkan ke dalam dokumen SOP (produk jasa otomatis dikecualikan).")) return;
    setLoading(true);
    try {
      const newDoc = await operationalService.initializeStockOpname({
        notes: notesInput || "Inisialisasi Stock Opname Produk Fisik (Android Apps)",
        initiatedBy: "Admin"
      });
      alert(`Dokumen Stock Opname berhasil dibuat!\nNomor: ${newDoc.sopNumber}\nTotal Produk Fisik: ${newDoc.totalItems} item.\n\nSilakan lakukan penghitungan melalui Android Apps.`);
      setNotesInput("");
      await loadData();
      const updatedList = await operationalService.getStockOpnameList();
      const created = updatedList.find((d: any) => d.id === newDoc.id || d.sopNumber === newDoc.sopNumber);
      if (created) selectOpnameDoc(created);
    } catch (err: any) {
      alert("Gagal inisialisasi SOP: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function selectOpnameDoc(sop: any) {
    setSelectedOpname(sop);
    setEditableItems(JSON.parse(JSON.stringify(sop.items || [])));
    setEditMode(false);
    setSearchQuery("");
  }

  // 2. Simpan Hasil Perhitungan sebagai Snapshot untuk Review & Penyesuaian
  async function handleSaveSnapshotReview() {
    if (!selectedOpname) return;
    setLoading(true);
    try {
      await operationalService.updateStockOpnameSnapshot(selectedOpname.id, editableItems);
      alert(`Snapshot perhitungan dokumen ${selectedOpname.sopNumber} berhasil disimpan untuk review & penyesuaian!`);
      await loadData();
      const updatedList = await operationalService.getStockOpnameList();
      const updated = updatedList.find((d: any) => d.id === selectedOpname.id);
      if (updated) selectOpnameDoc(updated);
      setEditMode(false);
    } catch (err: any) {
      alert("Gagal menyimpan snapshot: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // 3. Posting SOP (Format POST-YYYYMMDD-xxx & Catat ke Stock Movement)
  async function handlePostOpname() {
    if (!selectedOpname) return;
    if (selectedOpname.status === "POSTED") {
      alert("Dokumen SOP ini sudah di-posting sebelumnya!");
      return;
    }

    const confirmMsg = `KONFIRMASI POSTING STOCK OPNAME\n------------------------------------\nDokumen SOP: ${selectedOpname.sopNumber}\n\nTindakan ini akan:\n1. Menghasilkan dokumen Posting (POST-YYYYMMDD-xxx)\n2. Mengubah stok master produk sesuai hitungan fisik\n3. Mencatat selisih ke Stock Movement\n\nLanjutkan Posting?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const postDocNo = await operationalService.postStockOpname(selectedOpname.id, "Admin");
      alert(`Posting Stock Opname Berhasil!\nNomor Dokumen Posting: ${postDocNo}\nStok produk telah disesuaikan dan tercatat di Stock Movement.`);
      await loadData();
      const updatedList = await operationalService.getStockOpnameList();
      const updated = updatedList.find((d: any) => d.id === selectedOpname.id);
      if (updated) selectOpnameDoc(updated);
    } catch (err: any) {
      alert("Gagal melakukan posting SOP: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // 4. Ekspor ke Excel (.csv kompatibel penuh dengan Microsoft Excel) dengan Qty Variance & Amount Value Variance
  function handleExportExcel() {
    if (!selectedOpname) return;
    const headers = [
      "No",
      "No Dokumen SOP",
      "No Dokumen Posting",
      "SKU",
      "Nama Produk Fisik",
      "Stok Sistem",
      "Stok Fisik (Hasil Hitung)",
      "Qty Variance",
      "Harga Modal (HPP)",
      "Amount Value Variance (Rp)"
    ];

    const rows = (selectedOpname.items || []).map((it: any, idx: number) => {
      const sys = Number(it.systemStock) || 0;
      const phys = it.physicalStock !== null && it.physicalStock !== undefined ? Number(it.physicalStock) : sys;
      const qtyVar = phys - sys;
      const hpp = Number(it.capitalPrice) || 0;
      const amountValVar = qtyVar * hpp;

      return [
        idx + 1,
        `"${selectedOpname.sopNumber || "-"}"`,
        `"${selectedOpname.postingDocNo || "-"}"`,
        `"${it.sku || "-"}"`,
        `"${(it.productName || "").replace(/"/g, '""')}"`,
        sys,
        phys,
        qtyVar,
        hpp,
        amountValVar
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Laporan_Stock_Opname_${selectedOpname.sopNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 5. Ekspor ke PDF menggunakan jsPDF dengan Qty Variance & Amount Value Variance
  function handleExportPDF() {
    if (!selectedOpname) return;
    const doc = new jsPDF("l", "mm", "a4");
    doc.setFontSize(14);
    doc.text("LAPORAN HASIL STOCK OPNAME (PRODUK FISIK)", 14, 15);

    doc.setFontSize(10);
    doc.text(`No. Dokumen SOP : ${selectedOpname.sopNumber || "-"}`, 14, 23);
    doc.text(`No. Posting     : ${selectedOpname.postingDocNo || "Belum Posting"}`, 14, 29);
    doc.text(`Status          : ${selectedOpname.status || "-"}`, 14, 35);

    let y = 45;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("No", 14, y);
    doc.text("SKU", 24, y);
    doc.text("Nama Produk", 55, y);
    doc.text("Sistem", 140, y);
    doc.text("Fisik", 162, y);
    doc.text("Qty Variance", 182, y);
    doc.text("HPP (Rp)", 215, y);
    doc.text("Amount Value Variance (Rp)", 245, y);

    doc.line(14, y + 2, 285, y + 2);
    y += 7;
    doc.setFont("helvetica", "normal");

    let totalQtyVar = 0;
    let totalAmountVar = 0;

    (selectedOpname.items || []).forEach((it: any, idx: number) => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      const sys = Number(it.systemStock) || 0;
      const phys = it.physicalStock !== null && it.physicalStock !== undefined ? Number(it.physicalStock) : sys;
      const qtyVar = phys - sys;
      const hpp = Number(it.capitalPrice) || 0;
      const valVar = qtyVar * hpp;

      totalQtyVar += qtyVar;
      totalAmountVar += valVar;

      doc.text(String(idx + 1), 14, y);
      doc.text(String(it.sku || "-").slice(0, 14), 24, y);
      doc.text(String(it.productName || "-").slice(0, 42), 55, y);
      doc.text(String(sys), 140, y);
      doc.text(String(phys), 162, y);
      doc.text((qtyVar > 0 ? "+" : "") + String(qtyVar), 182, y);
      doc.text(hpp.toLocaleString("id-ID"), 215, y);
      doc.text((valVar >= 0 ? "Rp " : "-Rp ") + Math.abs(valVar).toLocaleString("id-ID"), 245, y);
      y += 6;
    });

    doc.line(14, y, 285, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL VARIANCE:", 120, y);
    doc.text((totalQtyVar > 0 ? "+" : "") + String(totalQtyVar), 182, y);
    doc.text((totalAmountVar >= 0 ? "Rp " : "-Rp ") + Math.abs(totalAmountVar).toLocaleString("id-ID"), 245, y);

    doc.save(`Stock_Opname_${selectedOpname.sopNumber}.pdf`);
  }

  const activeItems = (editMode ? editableItems : selectedOpname?.items || []).filter((it: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (it.productName || "").toLowerCase().includes(q) || (it.sku || "").toLowerCase().includes(q);
  });

  const summary = (selectedOpname?.items || []).reduce(
    (acc: any, it: any) => {
      const sys = Number(it.systemStock) || 0;
      const phys = it.physicalStock !== null && it.physicalStock !== undefined ? Number(it.physicalStock) : sys;
      const diff = phys - sys;
      const cap = Number(it.capitalPrice) || 0;
      acc.totalSys += sys;
      acc.totalPhys += phys;
      acc.totalQtyVar += diff;
      acc.totalValVar += diff * cap;
      return acc;
    },
    { totalSys: 0, totalPhys: 0, totalQtyVar: 0, totalValVar: 0 }
  );

  return (
    <>
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-800">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-xl border border-rose-100 shadow-xs gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Opname (SOP Produk Fisik)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Initialize <span className="font-mono font-bold text-[#BE185D]">SOP-YYYYMMDD-xxx</span> (Khusus Produk Fisik) &rarr; Hitung di Android Apps &rarr; Simpan Snapshot & Review &rarr; Posting <span className="font-mono font-bold text-emerald-600">POST-YYYYMMDD-xxx</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Catatan SOP baru (opsional)..."
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#BE185D] w-full md:w-56"
          />
          <button
            onClick={handleInitialize}
            disabled={loading}
            className="px-4 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow-xs transition whitespace-nowrap"
          >
            + Initialize SOP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daftar Dokumen SOP */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 lg:col-span-1 space-y-3 shadow-xs">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Dokumen SOP & Snapshot</h2>
            <button onClick={loadData} className="text-[11px] text-[#BE185D] font-bold hover:underline">
              Refresh
            </button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {opnameList.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center">Belum ada dokumen Stock Opname.</p>
            ) : (
              opnameList.map((sop) => (
                <div
                  key={sop.id}
                  onClick={() => selectOpnameDoc(sop)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedOpname?.id === sop.id
                      ? "border-[#BE185D] bg-rose-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-slate-900">{sop.sopNumber}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        sop.status === "POSTED"
                          ? "bg-emerald-100 text-emerald-700"
                          : sop.status === "REVIEW_ADJUSTMENT"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {sop.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                    <span>{sop.totalItems || (sop.items || []).length} Produk Fisik</span>
                    <span className="font-mono text-[10px] text-indigo-600 font-semibold">
                      {sop.postingDocNo || "Snapshot"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel Review Snapshot, Penyesuaian & Posting */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 lg:col-span-2 shadow-xs space-y-4">
          {selectedOpname ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 font-mono">{selectedOpname.sopNumber}</h3>
                    {selectedOpname.postingDocNo && (
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                        {selectedOpname.postingDocNo}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Status: <span className="font-bold text-slate-700">{selectedOpname.status}</span> | Catatan: {selectedOpname.notes || "-"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Export to Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Export to PDF
                  </button>

                  {selectedOpname.status !== "POSTED" && (
                    <>
                      {editMode ? (
                        <button
                          type="button"
                          onClick={handleSaveSnapshotReview}
                          disabled={loading}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs"
                        >
                          Simpan Snapshot Review
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditMode(true)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs"
                        >
                          Review & Sesuaikan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handlePostOpname}
                        disabled={loading}
                        className="px-3 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow-xs"
                      >
                        Posting SOP
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Ringkasan Qty Variance & Amount Value Variance */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Stok Sistem</span>
                  <span className="font-bold text-slate-800 font-mono text-sm">{summary.totalSys}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Stok Fisik</span>
                  <span className="font-bold text-slate-800 font-mono text-sm">{summary.totalPhys}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Qty Variance</span>
                  <span className={`font-bold font-mono text-sm ${summary.totalQtyVar < 0 ? "text-rose-600" : summary.totalQtyVar > 0 ? "text-emerald-600" : "text-slate-700"}`}>
                    {summary.totalQtyVar > 0 ? `+${summary.totalQtyVar}` : summary.totalQtyVar}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Amount Value Variance</span>
                  <span className={`font-bold font-mono text-sm ${summary.totalValVar < 0 ? "text-rose-600" : summary.totalValVar > 0 ? "text-emerald-600" : "text-slate-700"}`}>
                    Rp {(summary.totalValVar || 0).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Cari SKU atau nama produk fisik..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#BE185D]"
                />
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[480px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b font-semibold text-slate-700 sticky top-0">
                    <tr>
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5">Nama Produk Fisik</th>
                      <th className="p-2.5 text-right">Stok Sistem</th>
                      <th className="p-2.5 text-right">Hitungan Fisik</th>
                      <th className="p-2.5 text-right">Qty Variance</th>
                      <th className="p-2.5 text-right">HPP</th>
                      <th className="p-2.5 text-right">Amount Value Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          Tidak ada produk fisik yang sesuai pencarian.
                        </td>
                      </tr>
                    ) : (
                      activeItems.map((it: any, idx: number) => {
                        const sys = Number(it.systemStock) || 0;
                        const phys = it.physicalStock !== null && it.physicalStock !== undefined ? Number(it.physicalStock) : sys;
                        const qtyVar = phys - sys;
                        const cap = Number(it.capitalPrice) || 0;
                        const valVar = qtyVar * cap;

                        return (
                          <tr key={it.productId || idx} className="border-b hover:bg-rose-50/20">
                            <td className="p-2.5 font-mono font-bold text-[#BE185D]">{it.sku}</td>
                            <td className="p-2.5 font-medium text-slate-800">{it.productName}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{sys}</td>
                            <td className="p-2.5 text-right">
                              {editMode ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={it.physicalStock ?? sys}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    const updated = [...editableItems];
                                    const targetIdx = editableItems.findIndex((x) => x.productId === it.productId);
                                    if (targetIdx !== -1) {
                                      updated[targetIdx].physicalStock = isNaN(val) ? 0 : val;
                                      setEditableItems(updated);
                                    }
                                  }}
                                  className="w-20 p-1 border border-rose-300 rounded text-right font-mono font-bold bg-white focus:border-[#BE185D] outline-none"
                                />
                              ) : (
                                <span className="font-mono font-bold text-slate-900">
                                  {it.physicalStock !== null && it.physicalStock !== undefined ? it.physicalStock : `${sys} (Snapshot)`}
                                </span>
                              )}
                            </td>
                            <td className={`p-2.5 text-right font-mono font-bold ${qtyVar < 0 ? "text-rose-600" : qtyVar > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                              {qtyVar > 0 ? `+${qtyVar}` : qtyVar}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-600">
                              Rp {cap.toLocaleString("id-ID")}
                            </td>
                            <td className={`p-2.5 text-right font-mono font-bold ${valVar < 0 ? "text-rose-600" : valVar > 0 ? "text-emerald-600" : "text-slate-700"}`}>
                              Rp {valVar.toLocaleString("id-ID")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-slate-400 text-xs">
              Pilih dokumen Stock Opname di sebelah kiri untuk meninjau hasil hitungan Android Apps, melakukan penyesuaian snapshot, posting stok, atau ekspor ke PDF & Excel.
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
