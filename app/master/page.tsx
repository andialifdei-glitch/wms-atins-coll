"use client";

import React, { useState, useEffect } from "react";
import { operationalService } from "@/lib/operationalService";
import type { KonterProduct, KonterProductFamily } from "@/lib/types";
import * as XLSX from "xlsx";

export default function KonterMasterStockPage() {
  const [products, setProducts] = useState<KonterProduct[]>([]);
  const [families, setFamilies] = useState<KonterProductFamily[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Product State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  // State Form Produk dengan tambahan hppVoucher & kriteria fisik/jasa
  const [productForm, setProductForm] = useState({
    familyCode: "",
    sku: "",
    name: "",
    stockCategory: "FISIK" as "FISIK" | "JASA",
    productCategory: "Umum",
    unit: "Pcs",
    hppVoucher: 0,
    capitalPrice: 0, // HPP Modal
    sellingPrice: 0,
    status: "AKTIF" as "AKTIF" | "NONAKTIF",
    currentStock: 0,
    notes: ""
  });

  // Modal Family CRUD State
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [familyForm, setFamilyForm] = useState({ name: "", description: "" });

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [prodData, famData] = await Promise.all([
        operationalService.getProducts(),
        operationalService.getFamilies()
      ]);
      setProducts(prodData);
      setFamilies(famData);
      if (famData.length > 0 && !productForm.familyCode) {
        setProductForm(prev => ({ ...prev, familyCode: famData[0].code }));
      }
    } catch (err: any) {
      setMsg({ type: "error", text: "Gagal memuat data: " + err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleFamilyChange(code: string) {
    setProductForm(prev => ({ ...prev, familyCode: code }));
    if (!editingProductId) {
      try {
        const nextSku = await operationalService.generateNextSKU(code);
        setProductForm(prev => ({ ...prev, sku: nextSku }));
      } catch (err) {
        console.error("Gagal generate SKU:", err);
      }
    }
  }

  // Handle perubahan Kategori (Fisik / Jasa)
  function handleStockCategoryChange(category: "FISIK" | "JASA") {
    if (category === "JASA") {
      setProductForm(prev => ({
        ...prev,
        stockCategory: "JASA",
        unit: "trx",
        hppVoucher: 0
      }));
    } else {
      setProductForm(prev => ({
        ...prev,
        stockCategory: "FISIK",
        unit: "Pcs"
      }));
    }
  }

  async function handleOpenAddProduct() {
    setEditingProductId(null);
    const defaultFam = families[0]?.code || "";
    let nextSku = "";
    if (defaultFam) {
      try {
        nextSku = await operationalService.generateNextSKU(defaultFam);
      } catch (e) {}
    }
    setProductForm({
      familyCode: defaultFam,
      sku: nextSku,
      name: "",
      stockCategory: "FISIK",
      productCategory: "Umum",
      unit: "Pcs",
      hppVoucher: 0,
      capitalPrice: 0,
      sellingPrice: 0,
      status: "AKTIF",
      currentStock: 0,
      notes: ""
    });
    setIsProductModalOpen(true);
  }

  // Submit dengan Konfirmasi Preview dalam Alert sebelum OK
  async function handlePreSubmitProduct(e: React.FormEvent) {
    e.preventDefault();

    const previewText = `KONFIRMASI PENYIMPANAN PRODUK:
----------------------------------------
- SKU: ${productForm.sku}
- Nama Produk: ${productForm.name}
- Kategori: ${productForm.stockCategory}
- Family Code: ${productForm.familyCode}
- Satuan: ${productForm.unit}
${productForm.stockCategory === "FISIK" ? `- HPP Voucher: Rp ${Number(productForm.hppVoucher).toLocaleString("id-ID")}\n- HPP Modal: Rp ${Number(productForm.capitalPrice).toLocaleString("id-ID")}` : `- Harga / HPP Jasa: Rp ${Number(productForm.capitalPrice).toLocaleString("id-ID")}`}
- Harga Jual: Rp ${Number(productForm.sellingPrice).toLocaleString("id-ID")}
- Stok Awal: ${productForm.currentStock} ${productForm.unit}

Apakah data produk di atas sudah benar?`;

    const isConfirmed = window.confirm(previewText);
    if (!isConfirmed) return;

    try {
      await operationalService.saveProduct(productForm, editingProductId || undefined);
      setMsg({ type: "success", text: "Data produk berhasil disimpan." });
      setIsProductModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert("Gagal menyimpan produk: " + err.message);
    }
  }

  async function handleSaveFamily(e: React.FormEvent) {
    e.preventDefault();
    if (!familyForm.name.trim()) return;
    try {
      if (editingFamilyId) {
        await operationalService.updateFamily(editingFamilyId, familyForm.name, familyForm.description);
      } else {
        await operationalService.createFamily(familyForm.name, familyForm.description);
      }
      setFamilyForm({ name: "", description: "" });
      setEditingFamilyId(null);
      await loadData();
      alert("Family berhasil disimpan.");
    } catch (err: any) {
      alert("Gagal menyimpan family: " + err.message);
    }
  }

  async function handleDeleteFamily(id: string) {
    if (!confirm("Yakin ingin menghapus family ini?")) return;
    try {
      await operationalService.deleteFamily(id);
      await loadData();
    } catch (err: any) {
      alert("Gagal menghapus family: " + err.message);
    }
  }

  function handleExportProductsXlsx() {
    if (products.length === 0) {
      alert("Tidak ada data produk.");
      return;
    }
    const data = products.map((p, idx) => ({
      "No": idx + 1,
      "SKU": p.sku,
      "Nama Produk": p.name,
      "Family Code": p.familyCode,
      "Kategori": p.stockCategory,
      "Stok": p.currentStock,
      "Satuan": p.unit,
      "HPP Modal": p.capitalPrice,
      "Harga Jual": p.sellingPrice,
      "Status": p.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Produk");
    XLSX.writeFile(wb, `Master_Produk_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleDownloadProductTemplate() {
    const templateData = [
      { 
        "Family (Kode/Nama)": "FAM-001", 
        "Nama Produk": "Pulsa Telkomsel 10k", 
        "Kategori (FISIK/JASA)": "FISIK",
        "Satuan": "Pcs", 
        "HPP Voucher": 10000,
        "Harga Modal": 10200, 
        "Harga Jual": 12000, 
        "Stok Awal": 50, 
        "Status": "AKTIF" 
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Produk");
    XLSX.writeFile(wb, "Template_Import_Produk.xlsx");
  }

  function handleExportFamilyXlsx() {
    if (families.length === 0) {
      alert("Tidak ada data family.");
      return;
    }
    const data = families.map((f, idx) => ({
      "No": idx + 1,
      "Kode Family": f.code,
      "Nama Family": f.name,
      "Deskripsi": f.description || "-"
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Family");
    XLSX.writeFile(wb, `Master_Family_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleImportProductXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        if (json.length === 0) {
          alert("File Excel kosong.");
          return;
        }

        const productsToImport = json.map(row => ({
          familyNameOrCode: row["Family (Kode/Nama)"] || row["family"] || Object.values(row)[0],
          name: row["Nama Produk"] || row["name"] || Object.values(row)[1],
          stockCategory: (row["Kategori (FISIK/JASA)"] || row["stockCategory"] || "FISIK").toUpperCase() as "FISIK" | "JASA",
          unit: row["Satuan"] || row["unit"] || "Pcs",
          capitalPrice: Number(row["Harga Modal"] || row["capitalPrice"] || 0),
          sellingPrice: Number(row["Harga Jual"] || row["sellingPrice"] || 0),
          currentStock: Number(row["Stok Awal"] || row["currentStock"] || 0),
          status: (row["Status"] || row["status"] || "AKTIF").toUpperCase() as "AKTIF" | "NONAKTIF"
        }));

        const count = await operationalService.importProducts(productsToImport);
        alert(`Berhasil mengimpor ${count} produk! SKU telah digenerate otomatis.`);
        setIsProductModalOpen(false);
        await loadData();
      } catch (err: any) {
        alert("Gagal mengimpor produk: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="p-6 space-y-6 text-xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rose-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pengelolaan Stock &amp; Master Data</h1>
          <p className="text-xs text-slate-500">Kelola katalog produk, stok gudang, dan pengaturan family.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsFamilyModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-sm transition"
          >
            ⚙️ Kelola Family (CRUD)
          </button>
          <button
            onClick={handleOpenAddProduct}
            className="px-3.5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm transition"
          >
            + Tambah Produk
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      {/* Tabel Produk */}
      <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-rose-100 font-bold text-slate-900 flex justify-between items-center">
          <span>Daftar Katalog Produk &amp; Stok</span>
          <span className="text-xs text-slate-500 font-normal">Total Produk: {products.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100 text-slate-900 font-bold">
                <th className="p-3">SKU</th>
                <th className="p-3">Nama Produk</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 text-right">Stok</th>
                <th className="p-3 text-right">HPP Modal</th>
                <th className="p-3 text-right">Harga Jual</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-900 font-medium">
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-slate-400">Memuat data produk...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-slate-400">Belum ada data produk.</td></tr>
              ) : (
                products.map(p => (
                  <tr key={p.id} className="hover:bg-rose-50/20">
                    <td className="p-3 font-mono font-bold text-[#BE185D]">{p.sku}</td>
                    <td className="p-3 font-bold">{p.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.stockCategory === "FISIK" ? "bg-purple-100 text-purple-900" : "bg-blue-100 text-blue-900"}`}>
                        {p.stockCategory || "FISIK"}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">{p.currentStock} {p.unit}</td>
                    <td className="p-3 text-right font-mono">Rp {p.capitalPrice.toLocaleString("id-ID")}</td>
                    <td className="p-3 text-right font-mono font-bold">Rp {p.sellingPrice.toLocaleString("id-ID")}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === "AKTIF" ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setEditingProductId(p.id!);
                          setProductForm({
                            familyCode: p.familyCode,
                            sku: p.sku,
                            name: p.name,
                            stockCategory: p.stockCategory || "FISIK",
                            productCategory: p.productCategory,
                            unit: p.unit,
                            hppVoucher: (p as any).hppVoucher || 0,
                            capitalPrice: p.capitalPrice,
                            sellingPrice: p.sellingPrice,
                            status: p.status,
                            currentStock: p.currentStock,
                            notes: p.notes || ""
                          });
                          setIsProductModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded shadow-xs"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Produk */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-100 w-full max-w-xl p-5 text-slate-900 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-sm font-bold text-slate-900">{editingProductId ? "Edit Produk" : "Tambah Produk Baru"}</h2>
              <button onClick={() => setIsProductModalOpen(false)} className="px-2.5 py-1 bg-slate-200 rounded font-bold">Tutup X</button>
            </div>

            {!editingProductId && (
              <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg flex flex-wrap gap-2 items-center justify-between">
                <span className="font-bold text-slate-700">Impor / Ekspor Massal:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadProductTemplate}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded text-[11px]"
                  >
                    📄 Template (.xlsx)
                  </button>
                  <label className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] cursor-pointer">
                    📂 Impor Excel
                    <input type="file" accept=".xlsx, .xls" onChange={handleImportProductXlsx} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={handleExportProductsXlsx}
                    className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded text-[11px]"
                  >
                    📥 Ekspor Produk
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handlePreSubmitProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Pilih Family <span className="text-rose-600">*</span></label>
                  <select
                    value={productForm.familyCode}
                    onChange={(e) => handleFamilyChange(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white font-medium"
                  >
                    {families.map(f => (
                      <option key={f.code} value={f.code}>{f.code} - {f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">SKU (Auto Increment)</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={productForm.sku}
                    className="w-full p-2 border rounded-lg font-mono bg-slate-100 font-bold text-[#BE185D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Kategori Produk <span className="text-rose-600">*</span></label>
                  <select
                    value={productForm.stockCategory}
                    onChange={(e) => handleStockCategoryChange(e.target.value as "FISIK" | "JASA")}
                    className="w-full p-2 border rounded-lg bg-white font-medium"
                  >
                    <option value="FISIK">Fisik (Barang / Voucher)</option>
                    <option value="JASA">Jasa (Layanan / Transaksi)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nama Produk <span className="text-rose-600">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Nama produk..."
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Satuan (Unit)</label>
                  <input
                    type="text"
                    readOnly={productForm.stockCategory === "JASA"}
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className={`w-full p-2 border rounded-lg ${productForm.stockCategory === "JASA" ? "bg-slate-100 font-mono font-bold text-amber-700" : "bg-white"}`}
                  />
                  {productForm.stockCategory === "JASA" && <span className="text-[10px] text-slate-500">Satuan jasa otomatis &quot;trx&quot;</span>}
                </div>
                <div>
                  <label className="block font-semibold mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    disabled={!!editingProductId}
                    value={productForm.currentStock}
                    onChange={(e) => setProductForm({ ...productForm, currentStock: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg font-mono bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">HPP Voucher</label>
                  <input
                    type="number"
                    min="0"
                    disabled={productForm.stockCategory === "JASA"}
                    value={productForm.hppVoucher}
                    onChange={(e) => setProductForm({ ...productForm, hppVoucher: Number(e.target.value) })}
                    className={`w-full p-2 border rounded-lg font-mono ${productForm.stockCategory === "JASA" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white"}`}
                  />
                  {productForm.stockCategory === "JASA" && <span className="text-[10px] text-rose-600">Disabled untuk Jasa</span>}
                </div>
                <div>
                  <label className="block font-semibold mb-1">{productForm.stockCategory === "FISIK" ? "HPP Modal" : "Harga / HPP Jasa"}</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.capitalPrice}
                    onChange={(e) => setProductForm({ ...productForm, capitalPrice: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Harga Jual</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.sellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg font-mono bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-sm"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CRUD Family */}
      {isFamilyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-100 w-full max-w-3xl p-6 text-slate-900 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-[#2D121F]">Pengelolaan Family (CRUD)</h2>
                <p className="text-xs text-slate-500">Tambah, Edit, Hapus, dan Ekspor data Family.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportFamilyXlsx}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs"
                >
                  📥 Ekspor Family XLSX
                </button>
                <button onClick={() => setIsFamilyModalOpen(false)} className="px-3 py-1 bg-slate-200 rounded font-bold">Tutup X</button>
              </div>
            </div>

            <form onSubmit={handleSaveFamily} className="p-4 bg-slate-50 border rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-900">{editingFamilyId ? "Edit Family" : "+ Tambah Family Baru"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nama Family</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama family..."
                    value={familyForm.name}
                    onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Deskripsi</label>
                  <input
                    type="text"
                    placeholder="Deskripsi..."
                    value={familyForm.description}
                    onChange={(e) => setFamilyForm({ ...familyForm, description: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {editingFamilyId && (
                  <button
                    type="button"
                    onClick={() => { setEditingFamilyId(null); setFamilyForm({ name: "", description: "" }); }}
                    className="px-3 py-1.5 border rounded"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white font-bold rounded-lg shadow-xs"
                >
                  {editingFamilyId ? "Update Family" : "Simpan Family"}
                </button>
              </div>
            </form>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b font-bold text-slate-700">
                    <th className="p-2.5">Kode</th>
                    <th className="p-2.5">Nama Family</th>
                    <th className="p-2.5">Deskripsi</th>
                    <th className="p-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {families.length === 0 ? (
                    <tr><td colSpan={4} className="p-5 text-center text-slate-400">Belum ada data family.</td></tr>
                  ) : (
                    families.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-[#BE185D]">{f.code}</td>
                        <td className="p-2.5 font-bold">{f.name}</td>
                        <td className="p-2.5 text-slate-600">{f.description || "-"}</td>
                        <td className="p-2.5 text-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingFamilyId(f.id!);
                              setFamilyForm({ name: f.name, description: f.description || "" });
                            }}
                            className="px-2 py-1 bg-slate-800 text-white font-bold rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteFamily(f.id!)}
                            className="px-2 py-1 bg-rose-600 text-white font-bold rounded"
                          >
                            Hapus
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
    </div>
  );
}