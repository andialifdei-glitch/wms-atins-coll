"use client";

import React, { useState, useEffect, useMemo } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProduct, StockAdjustment } from "@/lib/types";

export default function StockAdjustmentPage() {
  const [activeTab, setActiveTab] = useState<"standard" | "ip_process" | "ip_settings">("standard");
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [ipRules, setIpRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search State
  const [searchStandard, setSearchStandard] = useState("");
  const [searchSource, setSearchSource] = useState("");
  const [searchTarget, setSearchTarget] = useState("");

  // Tab 1: Standard Adjustment State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [physicalStock, setPhysicalStock] = useState<number>(0);
  const [reason, setReason] = useState("");

  // Tab 2: Internal Purchase State
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [ipQtySource, setIpQtySource] = useState<number>(1);
  const [ipQtyTarget, setIpQtyTarget] = useState<number>(1);
  const [ipSellingPrice, setIpSellingPrice] = useState<number>(0);
  const [ipCapitalPrice, setIpCapitalPrice] = useState<number>(0);
  const [ipNotes, setIpNotes] = useState("");

  // Tab 3: Pengaturan Relasi State
  const [ruleSourceId, setRuleSourceId] = useState("");
  const [ruleTargetId, setRuleTargetId] = useState("");
  const [ruleRatio, setRuleRatio] = useState<number>(1);
  const [ruleNotes, setRuleNotes] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [prods, adjs, rules] = await Promise.all([
        operationalService.getProducts(),
        operationalService.getAdjustments(),
        operationalService.getIPRules ? operationalService.getIPRules() : Promise.resolve([])
      ]);
      setProducts(prods);
      setAdjustments(adjs);
      setIpRules(rules);

      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id || "");
        setPhysicalStock(prods[0].currentStock);
      }
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  // Filter Blank Voucher (Family BLANK VOUCHER)
  const blankVoucherProducts = useMemo(() => {
    return products.filter(p => {
      const fam = (p.familyCode || "").toUpperCase();
      const name = (p.name || "").toUpperCase();
      return fam.includes("BLANK") || fam.includes("VOUCHER") || name.includes("BLANK");
    });
  }, [products]);

  // Search Filter: Standard
  const filteredProducts = useMemo(() => {
    const q = searchStandard.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      (p.sku || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.familyCode || "").toLowerCase().includes(q)
    );
  }, [products, searchStandard]);

  // Search Filter: Blank Voucher (Source)
  const filteredSources = useMemo(() => {
    const q = searchSource.toLowerCase().trim();
    if (!q) return blankVoucherProducts;
    return blankVoucherProducts.filter(p =>
      (p.sku || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q)
    );
  }, [blankVoucherProducts, searchSource]);

  // Search Filter: Target Products
  const filteredTargets = useMemo(() => {
    const q = searchTarget.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p =>
      (p.sku || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q)
    );
  }, [products, searchTarget]);

  // Current Standard Product Selection
  const currentStdProduct = products.find(p => p.id === selectedProductId);
  const systemStock = currentStdProduct ? currentStdProduct.currentStock : 0;
  const diff = physicalStock - systemStock;

  // Selected Source & Target Product Objects
  const currentSourceProduct = products.find(p => p.id === selectedSourceId);
  const currentTargetProduct = products.find(p => p.id === selectedTargetId);

  // 1. Submit Standard Adjustment
  async function handleApplyAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setMsg({ type: "error", text: "Alasan penyesuaian wajib diisi." });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    try {
      await operationalService.executeStockAdjustment({
        productId: selectedProductId,
        physicalStock,
        reason,
        operatorName: "Admin Konter"
      });
      setMsg({ type: "success", text: "Penyesuaian stok berhasil disimpan." });
      setReason("");
      await loadAllData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // 2. Submit Proses Internal Purchase
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
- Bahan Baku: ${ipQtySource} ${currentSourceProduct.unit} (${currentSourceProduct.name})
- Produk Jadi: ${ipQtyTarget} ${currentTargetProduct.unit} (${currentTargetProduct.name})
- Nilai Jual: Rp ${Number(ipSellingPrice).toLocaleString("id-ID")}
- Nilai Modal (HPP): Rp ${Number(ipCapitalPrice).toLocaleString("id-ID")}

Stok bahan baku akan dikurangi dan stok produk target akan bertambah. Lanjutkan?`;

    if (!window.confirm(confirmText)) return;

    setSubmitting(true);
    setMsg(null);
    try {
      await (operationalService as any).processInternalPurchase({
        sourceProduct: currentSourceProduct,
        targetProduct: currentTargetProduct,
        qtySource: ipQtySource,
        qtyTarget: ipQtyTarget,
        sellingPriceTarget: ipSellingPrice,
        capitalPriceTarget: ipCapitalPrice,
        notes: ipNotes
      });
      setMsg({ type: "success", text: `Internal Purchase berhasil! Stok ${currentTargetProduct.name} bertambah ${ipQtyTarget} dan tercatat di kartu stok.` });
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

  // 3. Simpan Pengaturan Relasi
  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleSourceId || !ruleTargetId) return;

    setSubmitting(true);
    try {
      await (operationalService as any).saveIPRule({
        sourceProductId: ruleSourceId,
        targetProductId: ruleTargetId,
        ratio: Number(ruleRatio) || 1,
        notes: ruleNotes
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

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Adjustment &amp; Internal Purchase</h1>
          <p className="text-xs text-slate-500">Koreksi fisik stok gudang dan konversi material Blank Voucher ke produk siap jual.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab("standard")}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition ${activeTab === "standard" ? "bg-white text-[#BE185D] shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            📋 Penyesuaian Fisik
          </button>
          <button
            onClick={() => setActiveTab("ip_process")}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition ${activeTab === "ip_process" ? "bg-[#BE185D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            ⚡ Proses IP (Blank Voucher)
          </button>
          <button
            onClick={() => setActiveTab("ip_settings")}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition ${activeTab === "ip_settings" ? "bg-slate-800 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            ⚙️ Pengaturan Relasi IP
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg flex justify-between items-center ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* TAB 1: STANDARD ADJUSTMENT WITH SEARCHBAR */}
      {activeTab === "standard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Pilih Produk via Search Bar */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="font-bold text-slate-800">Daftar Produk ({filteredProducts.length})</span>
              <div className="w-full sm:w-64 relative">
                <input
                  type="text"
                  placeholder="🔍 Cari SKU atau nama produk..."
                  value={searchStandard}
                  onChange={(e) => setSearchStandard(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 border rounded-lg text-xs outline-none focus:border-[#BE185D] bg-white"
                />
                {searchStandard && (
                  <button onClick={() => setSearchStandard("")} className="absolute right-2.5 top-1.5 text-slate-400">✕</button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b text-slate-700">
                  <tr>
                    <th className="p-2.5">SKU</th>
                    <th className="p-2.5">Nama Produk</th>
                    <th className="p-2.5 text-right">Stok Sistem</th>
                    <th className="p-2.5 text-center">Pilih</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-800">
                  {filteredProducts.map(p => (
                    <tr key={p.id} className={`hover:bg-rose-50/20 ${selectedProductId === p.id ? "bg-rose-50/60 font-bold" : ""}`}>
                      <td className="p-2.5 font-mono text-[#BE185D]">{p.sku}</td>
                      <td className="p-2.5">{p.name}</td>
                      <td className="p-2.5 text-right font-mono">{p.currentStock} {p.unit}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductId(p.id!);
                            setPhysicalStock(p.currentStock);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold"
                        >
                          Pilih
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kolom Kanan: Form Penyesuaian Fisik */}
          <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 border-b pb-2">Eksekusi Koreksi Fisik</h3>
            {currentStdProduct ? (
              <form onSubmit={handleApplyAdjustment} className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                  <div className="text-[11px] text-slate-500">Produk Terpilih:</div>
                  <div className="font-bold text-sm text-[#BE185D]">{currentStdProduct.name}</div>
                  <div className="font-mono text-slate-600">SKU: {currentStdProduct.sku} | Stok Sistem: {systemStock} {currentStdProduct.unit}</div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Stok Fisik Sebenarnya</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={physicalStock}
                    onChange={(e) => setPhysicalStock(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg font-mono font-bold text-base"
                  />
                </div>

                <div className={`p-2.5 rounded-lg border font-mono font-bold text-center ${diff > 0 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : diff < 0 ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  Selisih: {diff > 0 ? `+${diff}` : diff} {currentStdProduct.unit}
                </div>

                <div>
                  <label className="block font-semibold mb-1">Alasan Penyesuaian <span className="text-rose-600">*</span></label>
                  <textarea
                    rows={2}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Contoh: Selisih opname fisik, barang rusak..."
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || diff === 0}
                  className="w-full py-2.5 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm"
                >
                  {submitting ? "Memproses..." : "Terapkan Penyesuaian"}
                </button>
              </form>
            ) : (
              <div className="p-8 text-center text-slate-400">Pilih produk pada daftar di samping.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROSES INTERNAL PURCHASE (BLANK VOUCHER) */}
      {activeTab === "ip_process" && (
        <form onSubmit={handleExecuteIP} className="bg-white p-6 rounded-xl border border-rose-100 shadow-xs space-y-6">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">⚡ Proses Konversi Internal Purchase (IP)</h2>
              <p className="text-slate-500">Potong stok Blank Voucher dan tambahkan ke stok produk turunan dengan nilai jual aktif.</p>
            </div>
            <span className="px-3 py-1 bg-rose-50 text-[#BE185D] border border-rose-200 rounded-full font-bold">
              Family: BLANK VOUCHER
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box Kiri: Product Source */}
            <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
              <span className="font-bold text-rose-900 text-sm">1. Bahan Baku (Product Source - Blank Voucher)</span>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Cari Blank Voucher..."
                  value={searchSource}
                  onChange={(e) => setSearchSource(e.target.value)}
                  className="w-full p-2 border rounded-lg text-xs bg-white outline-none focus:border-[#BE185D]"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg bg-white divide-y">
                {filteredSources.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">Tidak ada produk Blank Voucher.</div>
                ) : (
                  filteredSources.map(p => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedSourceId(p.id!)}
                      className={`p-2.5 cursor-pointer flex justify-between items-center hover:bg-rose-50/40 ${selectedSourceId === p.id ? "bg-rose-100/70 font-bold" : ""}`}
                    >
                      <div>
                        <div className="text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">SKU: {p.sku}</div>
                      </div>
                      <div className="font-mono text-[#BE185D] font-bold">Stok: {p.currentStock} {p.unit}</div>
                    </div>
                  ))
                )}
              </div>

              {currentSourceProduct && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-bold text-emerald-900">Source: {currentSourceProduct.name}</div>
                    <div className="text-[10px] text-emerald-700 font-mono">Stok Tersedia: {currentSourceProduct.currentStock} {currentSourceProduct.unit}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600">Qty Potong:</span>
                    <input
                      type="number"
                      min="1"
                      max={currentSourceProduct.currentStock || 1}
                      value={ipQtySource}
                      onChange={(e) => setIpQtySource(Math.max(1, Number(e.target.value)))}
                      className="w-16 p-1.5 border rounded-lg bg-white text-center font-bold font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Box Kanan: Product Target */}
            <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
              <span className="font-bold text-emerald-900 text-sm">2. Produk Turunan (Product Target - Siap Jual)</span>

              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Cari Produk Target Jadi..."
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  className="w-full p-2 border rounded-lg text-xs bg-white outline-none focus:border-[#BE185D]"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg bg-white divide-y">
                {filteredTargets.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedTargetId(p.id!);
                      setIpSellingPrice(p.sellingPrice || 0);
                      setIpCapitalPrice(p.capitalPrice || 0);
                    }}
                    className={`p-2.5 cursor-pointer flex justify-between items-center hover:bg-emerald-50/40 ${selectedTargetId === p.id ? "bg-emerald-100/70 font-bold" : ""}`}
                  >
                    <div>
                      <div className="text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">SKU: {p.sku}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div>Jual: Rp {(p.sellingPrice || 0).toLocaleString("id-ID")}</div>
                      <div className="text-[10px] text-slate-500">Stok: {p.currentStock} {p.unit}</div>
                    </div>
                  </div>
                ))}
              </div>

              {currentTargetProduct && (
                <div className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2">
                  <div className="font-bold text-emerald-900">Target: {currentTargetProduct.name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold">Qty Tambahan</label>
                      <input
                        type="number"
                        min="1"
                        value={ipQtyTarget}
                        onChange={(e) => setIpQtyTarget(Math.max(1, Number(e.target.value)))}
                        className="w-full p-1.5 border rounded-lg font-mono font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-rose-700">Nilai Jual (Wajib) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={ipSellingPrice}
                        onChange={(e) => setIpSellingPrice(Number(e.target.value))}
                        className="w-full p-1.5 border rounded-lg font-mono font-bold text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold">HPP Modal</label>
                      <input
                        type="number"
                        min="0"
                        value={ipCapitalPrice}
                        onChange={(e) => setIpCapitalPrice(Number(e.target.value))}
                        className="w-full p-1.5 border rounded-lg font-mono text-right"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Catatan Tambahan IP</label>
            <input
              type="text"
              value={ipNotes}
              onChange={(e) => setIpNotes(e.target.value)}
              placeholder="Nomor batch inject voucher, tanggal cetak, dsb..."
              className="w-full p-2 border rounded-lg bg-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              type="submit"
              disabled={submitting || !selectedSourceId || !selectedTargetId}
              className="px-6 py-2.5 bg-[#BE185D] hover:bg-[#9D174D] disabled:bg-slate-300 text-white font-bold rounded-lg shadow-md transition"
            >
              {submitting ? "Memproses Mutasi..." : "🚀 Eksekusi Internal Purchase"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: PENGATURAN RELASI SOURCE & TARGET */}
      {activeTab === "ip_settings" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">+ Pengaturan Relasi Bahan Baku &amp; Produk Turunan</h2>
            <form onSubmit={handleSaveRule} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block font-semibold mb-1">Product Source (Blank Voucher)</label>
                <select
                  required
                  value={ruleSourceId}
                  onChange={(e) => setRuleSourceId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="">-- Pilih Blank Voucher --</option>
                  {blankVoucherProducts.map(b => (
                    <option key={b.id} value={b.id}>{b.name} (Stok: {b.currentStock})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Product Target (Produk Jadi)</label>
                <select
                  required
                  value={ruleTargetId}
                  onChange={(e) => setRuleTargetId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="">-- Pilih Produk Turunan --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Rasio (Source : Target)</label>
                <input
                  type="number"
                  min="1"
                  value={ruleRatio}
                  onChange={(e) => setRuleRatio(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg font-mono text-center bg-white"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition"
                >
                  Simpan Aturan
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b font-bold text-slate-900">Daftar Relasi Source &amp; Target Tersimpan</div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b text-slate-700">
                <tr>
                  <th className="p-3">Product Source (Blank Voucher)</th>
                  <th className="p-3 text-center">Rasio</th>
                  <th className="p-3">Product Target (Produk Jadi)</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {ipRules.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">Belum ada pengaturan relasi IP.</td></tr>
                ) : (
                  ipRules.map(r => {
                    const src = products.find(p => p.id === r.sourceProductId);
                    const tgt = products.find(p => p.id === r.targetProductId);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-rose-800">{src ? src.name : r.sourceProductId}</td>
                        <td className="p-3 text-center font-mono font-bold">1 : {r.ratio || 1}</td>
                        <td className="p-3 font-semibold text-emerald-800">{tgt ? tgt.name : r.targetProductId}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm("Hapus aturan ini?")) {
                                await (operationalService as any).deleteIPRule(r.id);
                                loadAllData();
                              }
                            }}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold hover:bg-rose-100"
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
      )}
    </div>
  );
}