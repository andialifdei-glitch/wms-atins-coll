"use client";

import React, { useState, useEffect, useMemo } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProduct } from "@/lib/types";
import jsPDF from "jspdf";

export default function StockAdjustmentPage() {
  const [activeTab, setActiveTab] = useState<"standard" | "ip_process" | "ip_settings" | "stock_opname">("standard");
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tab 1: Standard Adjustment State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [physicalStock, setPhysicalStock] = useState<number>(0);
  const [reason, setReason] = useState("Koreksi Stok Fisik (Opname Harian)");
  const [searchTerm, setSearchTerm] = useState("");

  // Tab 2: Internal Purchase (IP) State
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [ipQtySource, setIpQtySource] = useState<number>(1);
  const [ipQtyTarget, setIpQtyTarget] = useState<number>(1);
  const [ipSellingPrice, setIpSellingPrice] = useState<number>(0);
  const [ipCapitalPrice, setIpCapitalPrice] = useState<number>(0);
  const [ipNotes, setIpNotes] = useState("");
  const [ipHistory, setIpHistory] = useState<any[]>([]);
  const [selectedIpDetail, setSelectedIpDetail] = useState<any | null>(null);

  // Tab 3: IP Rules State
  const [ipRules, setIpRules] = useState<any[]>([]);
  const [ruleSourceId, setRuleSourceId] = useState("");
  const [ruleTargetId, setRuleTargetId] = useState("");
  const [ruleRatio, setRuleRatio] = useState<number>(1);
  const [ruleNotes, setRuleNotes] = useState("");

  // Tab 4: Stock Opname (SOP) State
  const [opnameList, setOpnameList] = useState<any[]>([]);
  const [selectedOpname, setSelectedOpname] = useState<any | null>(null);
  const [sopEditMode, setSopEditMode] = useState(false);
  const [sopEditableItems, setSopEditableItems] = useState<any[]>([]);
  const [sopSearchQuery, setSopSearchQuery] = useState("");
  const [sopNotesInput, setSopNotesInput] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [prods, adjs, r, hist, sops] = await Promise.all([
        operationalService.getProducts(),
        operationalService.getAdjustments(),
        (operationalService as any).getIPRules ? (operationalService as any).getIPRules() : Promise.resolve([]),
        (operationalService as any).getInternalPurchases ? (operationalService as any).getInternalPurchases() : Promise.resolve([]),
        (operationalService as any).getStockOpnameList ? (operationalService as any).getStockOpnameList() : Promise.resolve([]),
      ]);
      setProducts(prods || []);
      setAdjustments(adjs || []);
      setIpRules(r || []);
      setIpHistory(hist || []);
      setOpnameList(sops || []);

      if (prods && prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id || "");
        setPhysicalStock(Number(prods[0].currentStock) || 0);
      }
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        ((p as any).familyCode || "").toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const currentSourceProduct = products.find((p) => p.id === selectedSourceId);
  const currentTargetProduct = products.find((p) => p.id === selectedTargetId);

  function formatDateSafe(raw: any): string {
    if (!raw) return "-";
    try {
      if (raw.seconds) return new Date(raw.seconds * 1000).toLocaleString("id-ID");
      if (typeof raw.toDate === "function") return raw.toDate().toLocaleString("id-ID");
      const d = new Date(raw);
      return isNaN(d.getTime()) ? "-" : d.toLocaleString("id-ID");
    } catch {
      return "-";
    }
  }

  // ================= 1. SUBMIT STANDARD ADJUSTMENT =================
  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await operationalService.executeStockAdjustment({
        productId: selectedProductId,
        physicalStock: Number(physicalStock),
        reason,
        operatorName: "Admin",
      });
      setMsg({ type: "success", text: "Penyesuaian stok fisik berhasil disimpan dan dicatat ke Stock Movement." });
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // ================= 2. SUBMIT INTERNAL PURCHASE (IP) =================
  async function handleExecuteIP(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSourceProduct || !currentTargetProduct) {
      alert("Pilih Produk Source (Blank Voucher) dan Produk Target!");
      return;
    }
    if ((currentSourceProduct.currentStock || 0) < ipQtySource) {
      alert(`Stok Blank Voucher (${currentSourceProduct.name}) tidak cukup! Sisa stok: ${currentSourceProduct.currentStock}`);
      return;
    }
    if (ipQtySource < ipQtyTarget) {
      alert("Aturan Validasi: Qty Product Source tidak boleh lebih kecil dari Qty Product Target!");
      return;
    }
    if (ipSellingPrice <= 0) {
      alert("Produk hasil IP wajib memiliki Harga Jual lebih besar dari 0!");
      return;
    }

    const confirmText = `KONFIRMASI INTERNAL PURCHASE (IP):
----------------------------------------
- Bahan Baku: ${ipQtySource} ${currentSourceProduct.unit || "Pcs"} (${currentSourceProduct.name})
- Produk Jadi: ${ipQtyTarget} ${currentTargetProduct.unit || "Pcs"} (${currentTargetProduct.name})
- Nilai Jual: Rp ${Number(ipSellingPrice).toLocaleString("id-ID")}
- Nilai Modal (HPP): Rp ${Number(ipCapitalPrice).toLocaleString("id-ID")}

Stok bahan baku akan dikurangi dan stok produk target akan bertambah. Lanjutkan?`;

    if (!window.confirm(confirmText)) return;

    setSubmitting(true);
    setMsg(null);
    try {
      const docNo = await (operationalService as any).processInternalPurchase({
        sourceProduct: currentSourceProduct,
        targetProduct: currentTargetProduct,
        qtySource: Number(ipQtySource),
        qtyTarget: Number(ipQtyTarget),
        sellingPriceTarget: Number(ipSellingPrice),
        capitalPriceTarget: Number(ipCapitalPrice),
        notes: ipNotes,
        operator: "Admin",
      });
      setMsg({
        type: "success",
        text: `Internal Purchase berhasil! No. Dokumen: ${docNo}. Stok ${currentTargetProduct.name} bertambah ${ipQtyTarget}.`,
      });
      setSelectedSourceId("");
      setSelectedTargetId("");
      setIpQtySource(1);
      setIpQtyTarget(1);
      setIpNotes("");
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memproses IP: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // ================= 3. PENGATURAN RELASI IP =================
  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleSourceId || !ruleTargetId) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await (operationalService as any).saveIPRule({
        sourceProductId: ruleSourceId,
        targetProductId: ruleTargetId,
        ratio: Number(ruleRatio) || 1,
        notes: ruleNotes,
      });
      setMsg({ type: "success", text: "Pengaturan relasi Source -> Target berhasil disimpan." });
      setRuleNotes("");
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal menyimpan rule: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!window.confirm("Hapus aturan relasi ini?")) return;
    try {
      await (operationalService as any).deleteIPRule(id);
      await loadAllData();
    } catch (err: any) {
      alert("Gagal menghapus relasi: " + err.message);
    }
  }

  // ================= 4. HANDLERS STOCK OPNAME (SOP) =================
  function selectOpnameDoc(sop: any) {
    setSelectedOpname(sop);
    setSopEditableItems(JSON.parse(JSON.stringify(sop.items || [])));
    setSopEditMode(false);
    setSopSearchQuery("");
  }

  async function handleInitializeSOP() {
    if (
      !window.confirm(
        "Inisialisasi dokumen Stock Opname baru?\n\nHanya PRODUK FISIK yang akan dimasukkan ke dalam dokumen SOP (produk jasa otomatis dikecualikan)."
      )
    )
      return;

    setSubmitting(true);
    setMsg(null);
    try {
      const newDoc = await (operationalService as any).initializeStockOpname({
        notes: sopNotesInput || "Inisialisasi Stock Opname Produk Fisik (Android Apps)",
        initiatedBy: "Admin",
      });
      setMsg({
        type: "success",
        text: `Dokumen SOP berhasil dibuat: ${newDoc.sopNumber} (${newDoc.totalItems} produk fisik). Silakan lakukan penghitungan di Android Apps.`,
      });
      setSopNotesInput("");
      await loadAllData();
      const sops = await (operationalService as any).getStockOpnameList();
      const created = (sops || []).find((d: any) => d.id === newDoc.id || d.sopNumber === newDoc.sopNumber);
      if (created) selectOpnameDoc(created);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal inisialisasi SOP: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSopSnapshot() {
    if (!selectedOpname) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await (operationalService as any).updateStockOpnameSnapshot(selectedOpname.id, sopEditableItems);
      setMsg({
        type: "success",
        text: `Snapshot perhitungan dokumen ${selectedOpname.sopNumber} berhasil disimpan untuk review & penyesuaian!`,
      });
      await loadAllData();
      const sops = await (operationalService as any).getStockOpnameList();
      const updated = (sops || []).find((d: any) => d.id === selectedOpname.id);
      if (updated) selectOpnameDoc(updated);
      setSopEditMode(false);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal menyimpan snapshot SOP: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostSOP() {
    if (!selectedOpname) return;
    if (selectedOpname.status === "POSTED") {
      alert("Dokumen SOP ini sudah di-posting sebelumnya!");
      return;
    }
    if (
      !window.confirm(
        `KONFIRMASI POSTING STOCK OPNAME (${selectedOpname.sopNumber}):\n\n1. Menghasilkan dokumen POST-YYYYMMDD-xxx\n2. Mengubah stok produk sesuai hitungan fisik\n3. Mencatat selisih ke Stock Movement\n\nLanjutkan Posting?`
      )
    )
      return;

    setSubmitting(true);
    setMsg(null);
    try {
      const postDocNo = await (operationalService as any).postStockOpname(selectedOpname.id, "Admin");
      setMsg({
        type: "success",
        text: `Posting Stock Opname Berhasil! Nomor Dokumen: ${postDocNo}. Stok produk telah diperbarui dan tercatat di Stock Movement.`,
      });
      await loadAllData();
      const sops = await (operationalService as any).getStockOpnameList();
      const updated = (sops || []).find((d: any) => d.id === selectedOpname.id);
      if (updated) selectOpnameDoc(updated);
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal posting SOP: " + err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function handleExportSopExcel() {
    if (!selectedOpname) return;
    const headers = [
      "No",
      "No Dokumen SOP",
      "No Dokumen Posting",
      "SKU",
      "Nama Produk Fisik",
      "Stok Sistem",
      "Stok Fisik",
      "Qty Variance",
      "Harga Modal (HPP)",
      "Amount Value Variance (Rp)",
    ];
    const rows = (selectedOpname.items || []).map((it: any, idx: number) => {
      const sys = Number(it.systemStock) || 0;
      const phys = it.physicalStock !== null && it.physicalStock !== undefined ? Number(it.physicalStock) : sys;
      const qtyVar = phys - sys;
      const hpp = Number(it.capitalPrice) || 0;
      const valVar = qtyVar * hpp;
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
        valVar,
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Stock_Opname_${selectedOpname.sopNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportSopPDF() {
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-xs text-slate-800 font-sans">
      {/* HEADER & TAB NAVIGATION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Stock Adjustment, Internal Purchase & Stock Opname</h1>
          <p className="text-slate-500 mt-0.5">
            Koreksi fisik stok gudang, konversi material Blank Voucher (IP), dan Stock Opname (SOP) produk fisik.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("standard")}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition ${
              activeTab === "standard" ? "bg-white text-[#BE185D] shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Penyesuaian Fisik
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ip_process")}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition ${
              activeTab === "ip_process" ? "bg-[#BE185D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Proses IP (Blank Voucher)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ip_settings")}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition ${
              activeTab === "ip_settings" ? "bg-slate-800 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pengaturan Relasi IP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stock_opname")}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition ${
              activeTab === "stock_opname"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Stock Opname (SOP)
          </button>
        </div>
      </div>

      {/* ALERT MESSAGE */}
      {msg && (
        <div
          className={`p-3 rounded-lg flex justify-between items-center ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span className="font-semibold">{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="font-bold text-slate-400 hover:text-slate-600 px-2"
          >
            X
          </button>
        </div>
      )}

      {/* ================= TAB 1: PENYESUAIAN FISIK ================= */}
      {activeTab === "standard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-xs space-y-4 lg:col-span-1">
            <h2 className="text-sm font-bold text-slate-900 border-b pb-2">Form Penyesuaian Stok</h2>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Cari Produk (Nama / SKU)</label>
              <input
                type="text"
                placeholder="Ketik nama produk atau SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded-lg bg-slate-50 outline-none focus:border-[#BE185D]"
              />
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">Pilih Produk</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const found = products.find((p) => p.id === e.target.value);
                    if (found) setPhysicalStock(Number(found.currentStock) || 0);
                  }}
                  className="w-full p-2 border rounded-lg bg-white outline-none focus:border-[#BE185D]"
                  required
                >
                  <option value="">-- Pilih Produk --</option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (Stok: {p.currentStock || 0})
                    </option>
                  ))}
                </select>
              </div>

              {currentProduct && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Stok Sistem Saat Ini</span>
                    <span className="font-mono font-bold text-sm text-slate-800">{currentProduct.currentStock || 0}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Selisih</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        physicalStock - (currentProduct.currentStock || 0) < 0
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {physicalStock - (currentProduct.currentStock || 0) > 0
                        ? `+${physicalStock - (currentProduct.currentStock || 0)}`
                        : physicalStock - (currentProduct.currentStock || 0)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Stok Fisik Sebenarnya</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={physicalStock}
                  onChange={(e) => setPhysicalStock(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 border rounded-lg font-mono font-bold outline-none focus:border-[#BE185D]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">Alasan Penyesuaian</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 border rounded-lg outline-none focus:border-[#BE185D]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedProductId}
                className="w-full py-2.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-xs transition disabled:bg-slate-300"
              >
                {submitting ? "Menyimpan..." : "Simpan Penyesuaian Stok"}
              </button>
            </form>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 lg:col-span-2">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-sm font-bold text-slate-900">Riwayat Penyesuaian Stok</h2>
              <button type="button" onClick={loadAllData} className="text-[#BE185D] font-bold hover:underline">
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b font-semibold text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Ref</th>
                    <th className="p-3">Produk</th>
                    <th className="p-3 text-center">Sistem</th>
                    <th className="p-3 text-center">Fisik</th>
                    <th className="p-3 text-center">Selisih</th>
                    <th className="p-3">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        Belum ada riwayat penyesuaian stok.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 text-slate-500">{formatDateSafe(a.createdAt)}</td>
                        <td className="p-3 font-mono font-bold text-indigo-600">{a.refCode || "-"}</td>
                        <td className="p-3 font-semibold">
                          [{a.sku}] {a.productName}
                        </td>
                        <td className="p-3 text-center font-mono">{a.systemStock}</td>
                        <td className="p-3 text-center font-mono font-bold">{a.physicalStock}</td>
                        <td
                          className={`p-3 text-center font-mono font-bold ${
                            a.difference < 0 ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {a.difference > 0 ? `+${a.difference}` : a.difference}
                        </td>
                        <td className="p-3 text-slate-600">{a.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: PROSES INTERNAL PURCHASE (IP) & RIWAYAT ================= */}
      {activeTab === "ip_process" && (
        <div className="space-y-6">
          <form
            onSubmit={handleExecuteIP}
            className="bg-white p-6 rounded-xl border border-rose-100 shadow-xs space-y-6"
          >
            <div className="border-b pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Eksekusi Internal Purchase (Konversi Blank Voucher -&gt; Produk Jadi)
              </h2>
              <p className="text-slate-500 mt-0.5">
                Menghasilkan nomor dokumen <span className="font-mono font-bold text-[#BE185D]">IP-YYYYMMDD-xxx</span>{" "}
                dan otomatis mencatat mutasi keluar-masuk stok.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bahan Baku (Source) */}
              <div className="p-4 bg-rose-50/40 rounded-xl border border-rose-100 space-y-3">
                <h3 className="font-bold text-[#BE185D]">1. Produk Sumber (Bahan Baku / Blank Voucher)</h3>
                <div>
                  <label className="block font-semibold mb-1">Pilih Produk Sumber</label>
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    required
                    className="w-full p-2 border rounded-lg bg-white outline-none focus:border-[#BE185D]"
                  >
                    <option value="">-- Pilih Produk Sumber --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} (Stok: {p.currentStock || 0})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Qty Sumber yang Digunakan</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={ipQtySource}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      setIpQtySource(val);
                      setIpQtyTarget(val);
                    }}
                    className="w-full p-2 border rounded-lg bg-white font-mono font-bold outline-none focus:border-[#BE185D]"
                  />
                </div>
              </div>

              {/* Produk Jadi (Target) */}
              <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-3">
                <h3 className="font-bold text-emerald-800">2. Produk Target (Voucher Fisik Siap Jual)</h3>
                <div>
                  <label className="block font-semibold mb-1">Pilih Produk Target</label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => {
                      setSelectedTargetId(e.target.value);
                      const targetProd = products.find((p) => p.id === e.target.value);
                      if (targetProd) {
                        setIpSellingPrice(Number(targetProd.sellingPrice) || 0);
                        setIpCapitalPrice(Number(targetProd.capitalPrice) || 0);
                      }
                    }}
                    required
                    className="w-full p-2 border rounded-lg bg-white outline-none focus:border-emerald-600"
                  >
                    <option value="">-- Pilih Produk Target --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} (Stok: {p.currentStock || 0})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">Qty Hasil</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={ipQtyTarget}
                      onChange={(e) => setIpQtyTarget(parseInt(e.target.value, 10) || 1)}
                      className="w-full p-2 border rounded-lg bg-white font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">HPP Baru (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={ipCapitalPrice}
                      onChange={(e) => setIpCapitalPrice(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border rounded-lg bg-white font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Harga Jual (Rp)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={ipSellingPrice}
                      onChange={(e) => setIpSellingPrice(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border rounded-lg bg-white font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block font-semibold mb-1">Catatan Konversi</label>
                <input
                  type="text"
                  placeholder="Contoh: Inject paket data harian..."
                  value={ipNotes}
                  onChange={(e) => setIpNotes(e.target.value)}
                  className="w-full p-2 border rounded-lg outline-none focus:border-[#BE185D]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-xs transition whitespace-nowrap"
              >
                {submitting ? "Memproses IP..." : "Eksekusi Internal Purchase"}
              </button>
            </div>
          </form>

          {/* TABEL RIWAYAT INTERNAL PURCHASE */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Riwayat Transaksi Internal Purchase</h3>
                <p className="text-xs text-slate-500">
                  Daftar eksekusi IP (<span className="font-mono font-bold text-[#BE185D]">IP-YYYYMMDD-xxx</span>)
                  beserta rincian perubahan stok
                </p>
              </div>
              <button
                type="button"
                onClick={loadAllData}
                className="text-xs font-bold text-[#BE185D] hover:underline"
              >
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b font-semibold text-slate-700">
                  <tr>
                    <th className="p-3">No. Dokumen IP</th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Bahan Baku (Sumber)</th>
                    <th className="p-3">Produk Jadi (Target)</th>
                    <th className="p-3 text-center">Qty (Out -&gt; In)</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ipHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        Belum ada riwayat transaksi Internal Purchase.
                      </td>
                    </tr>
                  ) : (
                    ipHistory.map((h) => (
                      <tr key={h.id} className="border-b hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-[#BE185D]">{h.docNo || "-"}</td>
                        <td className="p-3 text-slate-500">{formatDateSafe(h.createdAt)}</td>
                        <td className="p-3 font-medium text-slate-800">{h.sourceName}</td>
                        <td className="p-3 font-bold text-emerald-800">{h.targetName}</td>
                        <td className="p-3 text-center font-mono font-bold">
                          -{h.qtySource} -&gt; +{h.qtyTarget}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedIpDetail(h)}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition"
                          >
                            Lihat Detail
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
      )}

      {/* ================= TAB 3: PENGATURAN RELASI IP ================= */}
      {activeTab === "ip_settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSaveRule}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 lg:col-span-1"
          >
            <h2 className="text-sm font-bold text-slate-900 border-b pb-2">Tambah Relasi Source -&gt; Target</h2>
            <div>
              <label className="block font-semibold mb-1">Produk Sumber</label>
              <select
                value={ruleSourceId}
                onChange={(e) => setRuleSourceId(e.target.value)}
                required
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="">-- Pilih Sumber --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Produk Target</label>
              <select
                value={ruleTargetId}
                onChange={(e) => setRuleTargetId(e.target.value)}
                required
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="">-- Pilih Target --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Rasio Default</label>
              <input
                type="number"
                min="1"
                value={ruleRatio}
                onChange={(e) => setRuleRatio(parseInt(e.target.value, 10) || 1)}
                className="w-full p-2 border rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Keterangan</label>
              <input
                type="text"
                value={ruleNotes}
                onChange={(e) => setRuleNotes(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg"
            >
              Simpan Aturan Relasi
            </button>
          </form>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 lg:col-span-2">
            <h2 className="text-sm font-bold text-slate-900 border-b pb-2">Daftar Relasi Terdaftar</h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b font-semibold text-slate-600">
                  <tr>
                    <th className="p-3">Produk Sumber</th>
                    <th className="p-3">Produk Target</th>
                    <th className="p-3 text-center">Rasio</th>
                    <th className="p-3">Catatan</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ipRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        Belum ada aturan relasi IP.
                      </td>
                    </tr>
                  ) : (
                    ipRules.map((r) => {
                      const sProd = products.find((p) => p.id === r.sourceProductId);
                      const tProd = products.find((p) => p.id === r.targetProductId);
                      return (
                        <tr key={r.id} className="border-b">
                          <td className="p-3 font-semibold">{sProd ? sProd.name : r.sourceProductId}</td>
                          <td className="p-3 font-semibold text-emerald-700">
                            {tProd ? tProd.name : r.targetProductId}
                          </td>
                          <td className="p-3 text-center font-mono">{r.ratio || 1}</td>
                          <td className="p-3 text-slate-500">{r.notes || "-"}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(r.id)}
                              className="text-rose-600 font-bold hover:underline"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: STOCK OPNAME (SOP) PRODUK FISIK ================= */}
      {activeTab === "stock_opname" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-xl border border-emerald-200 shadow-xs gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Modul Stock Opname (SOP Produk Fisik)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Initialize <span className="font-mono font-bold text-[#BE185D]">SOP-YYYYMMDD-xxx</span> (Hanya Produk
                Fisik, Tanpa Jasa) -&gt; Hitung di Android Apps -&gt; Simpan Snapshot &amp; Review -&gt; Posting{" "}
                <span className="font-mono font-bold text-emerald-600">POST-YYYYMMDD-xxx</span>.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Catatan SOP baru..."
                value={sopNotesInput}
                onChange={(e) => setSopNotesInput(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-600 w-full md:w-56"
              />
              <button
                type="button"
                onClick={handleInitializeSOP}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition whitespace-nowrap"
              >
                + Initialize SOP Baru
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daftar Dokumen SOP */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 lg:col-span-1 space-y-3 shadow-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Daftar Dokumen SOP</h3>
                <button
                  type="button"
                  onClick={loadAllData}
                  className="text-[11px] text-emerald-600 font-bold hover:underline"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {opnameList.length === 0 ? (
                  <p className="text-xs text-slate-400 p-6 text-center">Belum ada dokumen Stock Opname.</p>
                ) : (
                  opnameList.map((sop) => (
                    <div
                      key={sop.id}
                      onClick={() => selectOpnameDoc(sop)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedOpname?.id === sop.id
                          ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
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

            {/* Detail Snapshot, Review, Posting & Export */}
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
                        Status: <span className="font-bold text-slate-700">{selectedOpname.status}</span> | Catatan:{" "}
                        {selectedOpname.notes || "-"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleExportSopExcel}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs"
                      >
                        Export to Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportSopPDF}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs"
                      >
                        Export to PDF
                      </button>

                      {selectedOpname.status !== "POSTED" && (
                        <>
                          {sopEditMode ? (
                            <button
                              type="button"
                              onClick={handleSaveSopSnapshot}
                              disabled={submitting}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs"
                            >
                              Simpan Snapshot
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSopEditMode(true)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs"
                            >
                              Review &amp; Sesuaikan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handlePostSOP}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-lg shadow-xs"
                          >
                            Posting SOP
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ringkasan Qty Variance & Amount Value Variance */}
                  {(() => {
                    const sum = (selectedOpname.items || []).reduce(
                      (acc: any, it: any) => {
                        const sys = Number(it.systemStock) || 0;
                        const phys =
                          it.physicalStock !== null && it.physicalStock !== undefined ? Number(it.physicalStock) : sys;
                        const diff = phys - sys;
                        const cap = Number(it.capitalPrice) || 0;
                        acc.sys += sys;
                        acc.phys += phys;
                        acc.qtyVar += diff;
                        acc.valVar += diff * cap;
                        return acc;
                      },
                      { sys: 0, phys: 0, qtyVar: 0, valVar: 0 }
                    );
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Stok Sistem</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">{sum.sys}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Stok Fisik</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">{sum.phys}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Qty Variance</span>
                          <span
                            className={`font-bold font-mono text-sm ${
                              sum.qtyVar < 0
                                ? "text-rose-600"
                                : sum.qtyVar > 0
                                ? "text-emerald-600"
                                : "text-slate-700"
                            }`}
                          >
                            {sum.qtyVar > 0 ? `+${sum.qtyVar}` : sum.qtyVar}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Amount Value Variance</span>
                          <span
                            className={`font-bold font-mono text-sm ${
                              sum.valVar < 0
                                ? "text-rose-600"
                                : sum.valVar > 0
                                ? "text-emerald-600"
                                : "text-slate-700"
                            }`}
                          >
                            Rp {(sum.valVar || 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <input
                    type="text"
                    placeholder="Cari SKU atau nama produk fisik..."
                    value={sopSearchQuery}
                    onChange={(e) => setSopSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-600"
                  />

                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[450px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 border-b font-semibold text-slate-700 sticky top-0">
                        <tr>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Nama Produk Fisik</th>
                          <th className="p-2.5 text-right">Sistem</th>
                          <th className="p-2.5 text-right">Fisik</th>
                          <th className="p-2.5 text-right">Qty Variance</th>
                          <th className="p-2.5 text-right">HPP</th>
                          <th className="p-2.5 text-right">Amount Value Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((sopEditMode ? sopEditableItems : selectedOpname.items) || [])
                          .filter((it: any) => {
                            if (!sopSearchQuery.trim()) return true;
                            const q = sopSearchQuery.toLowerCase();
                            return (
                              (it.productName || "").toLowerCase().includes(q) ||
                              (it.sku || "").toLowerCase().includes(q)
                            );
                          })
                          .map((it: any, idx: number) => {
                            const sys = Number(it.systemStock) || 0;
                            const phys =
                              it.physicalStock !== null && it.physicalStock !== undefined
                                ? Number(it.physicalStock)
                                : sys;
                            const qtyVar = phys - sys;
                            const cap = Number(it.capitalPrice) || 0;
                            const valVar = qtyVar * cap;

                            return (
                              <tr key={it.productId || idx} className="border-b hover:bg-slate-50">
                                <td className="p-2.5 font-mono font-bold text-[#BE185D]">{it.sku}</td>
                                <td className="p-2.5 font-medium text-slate-800">{it.productName}</td>
                                <td className="p-2.5 text-right font-mono text-slate-600">{sys}</td>
                                <td className="p-2.5 text-right">
                                  {sopEditMode ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={it.physicalStock ?? sys}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        const updated = [...sopEditableItems];
                                        const tIdx = sopEditableItems.findIndex((x) => x.productId === it.productId);
                                        if (tIdx !== -1) {
                                          updated[tIdx].physicalStock = isNaN(val) ? 0 : val;
                                          setSopEditableItems(updated);
                                        }
                                      }}
                                      className="w-20 p-1 border border-emerald-400 rounded text-right font-mono font-bold bg-white outline-none"
                                    />
                                  ) : (
                                    <span className="font-mono font-bold text-slate-900">
                                      {it.physicalStock !== null && it.physicalStock !== undefined
                                        ? it.physicalStock
                                        : sys}
                                    </span>
                                  )}
                                </td>
                                <td
                                  className={`p-2.5 text-right font-mono font-bold ${
                                    qtyVar < 0
                                      ? "text-rose-600"
                                      : qtyVar > 0
                                      ? "text-emerald-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {qtyVar > 0 ? `+${qtyVar}` : qtyVar}
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-600">
                                  Rp {cap.toLocaleString("id-ID")}
                                </td>
                                <td
                                  className={`p-2.5 text-right font-mono font-bold ${
                                    valVar < 0
                                      ? "text-rose-600"
                                      : valVar > 0
                                      ? "text-emerald-600"
                                      : "text-slate-700"
                                  }`}
                                >
                                  Rp {valVar.toLocaleString("id-ID")}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-16 text-center text-slate-400 text-xs">
                  Pilih dokumen Stock Opname di sebelah kiri atau klik <b>+ Initialize SOP Baru</b> untuk memulai.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DETAIL INTERNAL PURCHASE ================= */}
      {selectedIpDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Detail Internal Purchase</h3>
                <span className="font-mono text-xs font-bold text-[#BE185D]">{selectedIpDetail.docNo}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIpDetail(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-sm font-bold"
              >
                X
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Waktu Eksekusi</span>
                  <span className="font-semibold text-slate-700">{formatDateSafe(selectedIpDetail.createdAt)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Operator</span>
                  <span className="font-semibold text-slate-700">{selectedIpDetail.operator || "Admin"}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-slate-700 block border-b pb-1">Bahan Baku / Produk Sumber (Out)</span>
                <div className="flex justify-between">
                  <span>Nama:</span>
                  <span className="font-bold text-slate-800">{selectedIpDetail.sourceName}</span>
                </div>
                <div className="flex justify-between">
                  <span>SKU:</span>
                  <span className="font-mono font-semibold">{selectedIpDetail.sourceSku || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Qty Dipakai:</span>
                  <span className="font-bold text-rose-600">
                    -{selectedIpDetail.qtySource} {selectedIpDetail.sourceUnit || "Pcs"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Perubahan Stok:</span>
                  <span>
                    {selectedIpDetail.sourceBalanceBefore} -&gt; {selectedIpDetail.sourceBalanceAfter}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="font-bold text-slate-700 block border-b pb-1">Hasil Konversi / Produk Jadi (In)</span>
                <div className="flex justify-between">
                  <span>Nama:</span>
                  <span className="font-bold text-emerald-800">{selectedIpDetail.targetName}</span>
                </div>
                <div className="flex justify-between">
                  <span>SKU:</span>
                  <span className="font-mono font-semibold">{selectedIpDetail.targetSku || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Qty Dihasilkan:</span>
                  <span className="font-bold text-emerald-600">
                    +{selectedIpDetail.qtyTarget} {selectedIpDetail.targetUnit || "Pcs"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Perubahan Stok:</span>
                  <span>
                    {selectedIpDetail.targetBalanceBefore} -&gt; {selectedIpDetail.targetBalanceAfter}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Harga Pokok / Jual:</span>
                  <span>
                    Rp {(selectedIpDetail.capitalPriceTarget || 0).toLocaleString("id-ID")} / Rp{" "}
                    {(selectedIpDetail.sellingPriceTarget || 0).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {selectedIpDetail.notes && (
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-amber-800">
                  <span className="font-bold">Catatan:</span> {selectedIpDetail.notes}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedIpDetail(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}