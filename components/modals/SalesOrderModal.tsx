"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatRupiah } from "@/lib/formatters";

interface Props {
  isOpen: boolean;
  editingSoId: string | null;
  customers: any[];
  products: any[];
  storeOriginId: number;
  initialCustomer?: any;
  initialItems?: any[];
  initialRates?: any[];
  initialCost?: number;
  initialCourier?: string;
  initialService?: string;
  onClose: () => void;
  onSaveSo: (payload: any) => Promise<void>;
  showAlert: (msg: string, title?: string) => void;
}

export default function SalesOrderModal({
  isOpen,
  editingSoId,
  customers,
  products,
  storeOriginId,
  initialCustomer,
  initialItems = [],
  initialRates = [],
  initialCost = 0,
  initialCourier = "",
  initialService = "",
  onClose,
  onSaveSo,
  showAlert,
}: Props) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [inputQty, setInputQty] = useState(1);
  const [customPrice, setCustomPrice] = useState<number>(0);

  const [soItems, setSoItems] = useState<any[]>([]);

  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [selectedRateIndex, setSelectedRateIndex] = useState<number | "MANUAL">("MANUAL");
  const [manualCost, setManualCost] = useState<number>(0);
  const [loadingRates, setLoadingRates] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialCustomer) {
        setSelectedCustomer(initialCustomer);
        setCustomerSearch(initialCustomer.customerName || "");
      } else if (customers.length > 0) {
        setSelectedCustomer(customers[0]);
        setCustomerSearch(customers[0].customerName || "");
      }
      setSoItems(initialItems.length > 0 ? initialItems : []);

      if (initialRates && initialRates.length > 0) {
        setShippingRates(initialRates);
        const idx = initialRates.findIndex((r) => r.serviceName === initialService);
        if (idx >= 0) {
          setSelectedRateIndex(idx);
        } else if (initialCourier === "KURIR_TOKO") {
          setSelectedRateIndex("MANUAL");
          setManualCost(initialCost || 0);
        }
      } else {
        setShippingRates([]);
        setSelectedRateIndex("MANUAL");
        setManualCost(initialCost || 0);
      }
    }
  }, [isOpen, initialCustomer, initialItems, initialRates, initialCost, initialCourier, initialService, customers]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        (c.customerName || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.filter((p) => p.active !== false);
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.active !== false &&
        ((p.sku || "").toLowerCase().includes(q) || (p.itemName || "").toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const totalWeightGrams = useMemo(() => {
    return soItems.reduce((acc, it) => acc + (Number(it.weightInGrams || 0) * Number(it.qty || 1)), 0);
  }, [soItems]);

  const totalWeightKg = (totalWeightGrams / 1000).toFixed(2);

  const subtotalBelanja = useMemo(() => {
    return soItems.reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
  }, [soItems]);

  const activeShipping = useMemo(() => {
    if (selectedRateIndex === "MANUAL") {
      return {
        courier: "KURIR_TOKO",
        serviceName: "Kurir Toko (Tarif Manual)",
        cost: Number(manualCost) || 0,
      };
    }
    const rate = shippingRates[selectedRateIndex];
    if (rate) {
      return {
        courier: rate.courier,
        serviceName: rate.serviceName,
        cost: Number(rate.cost) || 0,
      };
    }
    return {
      courier: "KURIR_TOKO",
      serviceName: "Kurir Toko (Tarif Manual)",
      cost: Number(manualCost) || 0,
    };
  }, [selectedRateIndex, manualCost, shippingRates]);

  const grandTotal = subtotalBelanja + activeShipping.cost;

  const isFormValid = useMemo(() => {
    if (!selectedCustomer) return false;
    if (soItems.length === 0) return false;
    if (selectedRateIndex === "MANUAL" && manualCost < 0) return false;
    return true;
  }, [selectedCustomer, soItems, selectedRateIndex, manualCost]);

  function handleSelectProduct(prod: any) {
    setSelectedProduct(prod);
    setProductSearch(prod.itemName);
    setCustomPrice(Number(prod.netPrice || 0));
    setShowProdDropdown(false);
  }

  function handleAddItem() {
    if (!selectedProduct) return showAlert("Pilih produk terlebih dahulu!");
    if (selectedProduct.stock < inputQty) {
      return showAlert(`Stok produk [${selectedProduct.itemName}] tidak mencukupi (Tersedia: ${selectedProduct.stock} pcs).`);
    }

    const price = Number(customPrice) || 0;
    const existIndex = soItems.findIndex((it) => it.sku === selectedProduct.sku);

    if (existIndex >= 0) {
      const updated = [...soItems];
      const newQty = updated[existIndex].qty + inputQty;
      if (selectedProduct.stock < newQty) {
        return showAlert(`Total produk melebihi stok yang tersedia (${selectedProduct.stock} pcs).`);
      }
      updated[existIndex].qty = newQty;
      updated[existIndex].price = price;
      updated[existIndex].subtotal = newQty * price;
      setSoItems(updated);
    } else {
      setSoItems([
        ...soItems,
        {
          sku: selectedProduct.sku,
          itemName: selectedProduct.itemName,
          price: price,
          qty: inputQty,
          weightInGrams: Number(selectedProduct.weightInGrams || 0),
          subtotal: inputQty * price,
        },
      ]);
    }

    setSelectedProduct(null);
    setProductSearch("");
    setInputQty(1);
    setCustomPrice(0);
  }

  function handleUpdateItemPrice(index: number, newPrice: number) {
    const updated = [...soItems];
    const val = Math.max(0, newPrice || 0);
    updated[index].price = val;
    updated[index].subtotal = updated[index].qty * val;
    setSoItems(updated);
  }

  function handleRemoveItem(index: number) {
    setSoItems(soItems.filter((_, i) => i !== index));
  }

  async function handleCheckOngkirApi() {
    if (!selectedCustomer) return showAlert("Pilih customer terlebih dahulu!");
    setLoadingRates(true);
    try {
      const res = await fetch("/api/shipping/cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: storeOriginId || 4997,
          destination: selectedCustomer.destinationId || 4997,
          weight: Math.max(1000, totalWeightGrams),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.rates)) {
        setShippingRates(data.rates);
        if (data.rates.length > 0) {
          setSelectedRateIndex(0);
        }
      } else {
        showAlert(data.message || "Gagal memuat tarif ongkir.");
      }
    } catch {
      showAlert("Gagal menghubungi server ongkos kirim.");
    } finally {
      setLoadingRates(false);
    }
  }

  async function handleSubmitSo(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return showAlert("Lengkapi seluruh isian data sebelum menyimpan!");

    const finalRatesSnapshot = [
      ...shippingRates,
      { courier: "KURIR_TOKO", serviceName: "Kurir Toko (Tarif Manual)", cost: Number(manualCost) || 0, etd: "1 Hari" },
    ];

    setSubmitting(true);
    try {
      await onSaveSo({
        editingSoId,
        selectedCustomer,
        soItems,
        shippingRates: finalRatesSnapshot,
        shippingCost: activeShipping.cost,
        courierCode: activeShipping.courier,
        serviceName: activeShipping.serviceName,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-4xl p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-sm font-bold text-slate-900">
            {editingSoId ? `Edit Sales Order [${editingSoId}]` : "Buat Sales Order Baru"}
          </h3>
          <button type="button" onClick={() => { setShippingRates([]); setSelectedRateIndex("MANUAL"); setManualCost(0); onClose(); }} className="text-slate-400 hover:text-slate-600 text-lg font-bold leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmitSo} className="space-y-4 text-xs">
          {/* CUSTOMER SEARCH BERSIH TANPA CAPTION BERLEBIHAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="relative">
              <label className="block font-semibold text-slate-700 mb-1">Customer</label>
              <input
                type="text"
                placeholder="Cari nama customer..."
                value={customerSearch}
                onFocus={() => setShowCustDropdown(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustDropdown(true);
                }}
                className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white font-medium"
              />
              {showCustDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                  {filteredCustomers.map((c) => (
                    <div
                      key={c.id || c.customerId}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearch(c.customerName || "");
                        setShowCustDropdown(false);
                      }}
                      className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                    >
                      <div className="font-semibold text-slate-900">{c.customerName}</div>
                      <div className="text-[10px] text-slate-500">{c.phone || "-"}</div>
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="p-2.5 text-center text-slate-400">Customer tidak ditemukan</div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
              <div className="font-semibold text-slate-900">{selectedCustomer?.customerName || "Pilih customer dari daftar"}</div>
              <div className="text-slate-500 text-[11px] truncate mt-0.5">
                {selectedCustomer?.displayAddress || selectedCustomer?.address || "Alamat customer belum diatur"}
              </div>
            </div>
          </div>

          {/* PILIH PRODUK & CUSTOM HARGA */}
          <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-3">
            <span className="font-bold text-slate-800 block text-xs">Pilih Produk &amp; Harga Jual</span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div className="relative md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Produk</label>
                <input
                  type="text"
                  placeholder="Cari SKU atau nama produk..."
                  value={productSearch}
                  onFocus={() => setShowProdDropdown(true)}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProdDropdown(true);
                  }}
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none bg-white font-medium"
                />
                {showProdDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-semibold text-slate-900">{p.sku} - {p.itemName}</div>
                        <div className="text-[10px] text-slate-500">Stok: {p.stock} pcs • Harga: {formatRupiah(p.netPrice)}</div>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="p-2.5 text-center text-slate-400">Produk tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Harga Jual Satuan (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none font-bold text-slate-900 font-mono"
                />
              </div>

              <div className="flex gap-2">
                <div className="w-20">
                  <label className="block font-semibold text-slate-700 mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={inputQty}
                    onChange={(e) => setInputQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none text-center font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex-1 py-2 bg-[#9F1239] hover:bg-[#881337] text-white font-semibold rounded-lg shadow-xs transition"
                >
                  + Tambah
                </button>
              </div>
            </div>

            <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Nama Barang</th>
                  <th className="p-2 w-36">Harga Jual (Edit)</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Berat</th>
                  <th className="p-2 text-right">Subtotal</th>
                  <th className="p-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {soItems.map((it, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-mono font-bold text-slate-900">{it.sku}</td>
                    <td className="p-2 font-medium">{it.itemName}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        value={it.price}
                        onChange={(e) => handleUpdateItemPrice(idx, parseInt(e.target.value) || 0)}
                        className="w-full p-1 border border-slate-200 rounded font-semibold font-mono text-slate-900 bg-slate-50"
                      />
                    </td>
                    <td className="p-2 text-center font-bold">{it.qty}</td>
                    <td className="p-2 text-right text-slate-500 font-mono">{(it.weightInGrams || 0) * it.qty} gr</td>
                    <td className="p-2 text-right font-bold text-emerald-700">{formatRupiah(it.subtotal)}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-600 hover:text-rose-800 font-bold px-2"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
                {soItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400">Belum ada item barang yang dipilih.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* EKSPEDISI & ONGKIR */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="font-bold text-slate-800 block text-xs">Pilihan Jasa Ekspedisi</span>
                <p className="text-[11px] text-slate-500">Tarif Wahana Economy, Lion Parcel, dan SPX, atau Kurir Toko manual</p>
              </div>
              <button
                type="button"
                disabled={loadingRates}
                onClick={handleCheckOngkirApi}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg text-xs font-semibold transition"
              >
                {loadingRates ? "Memeriksa Tarif..." : "Cek Ongkir Ekspedisi"}
              </button>
            </div>

            {shippingRates.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700 block text-[11px]">Hasil Cek Ongkir Resmi:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {shippingRates.map((rate, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedRateIndex(idx)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition ${
                        selectedRateIndex === idx ? "bg-[#9F1239] text-white border-[#9F1239] shadow-xs" : "bg-white border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <div className="font-bold">{rate.serviceName}</div>
                      <div className={`text-[10px] ${selectedRateIndex === idx ? "text-rose-100" : "text-slate-500"}`}>Estimasi: {rate.etd}</div>
                      <div className="font-bold text-sm mt-1">{formatRupiah(rate.cost)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OPSI KURIR TOKO MANUAL */}
            <div
              onClick={() => setSelectedRateIndex("MANUAL")}
              className={`p-3 rounded-lg border cursor-pointer transition ${
                selectedRateIndex === "MANUAL" ? "bg-rose-50/70 border-[#9F1239]" : "bg-white border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="shippingOption"
                    checked={selectedRateIndex === "MANUAL"}
                    onChange={() => setSelectedRateIndex("MANUAL")}
                    className="accent-[#9F1239]"
                  />
                  <div>
                    <div className="font-bold text-slate-900">Kurir Toko (Tarif Manual)</div>
                    <div className="text-[11px] text-slate-500">Pengiriman armada toko dengan penentuan ongkir manual</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Ongkir (Rp):</span>
                  <input
                    type="number"
                    min="0"
                    value={manualCost}
                    onClick={(e) => { e.stopPropagation(); setSelectedRateIndex("MANUAL"); }}
                    onChange={(e) => setManualCost(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 p-1.5 border border-slate-300 rounded-lg outline-none font-bold font-mono text-emerald-700 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TOTAL & SUBMIT */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-600">
                Total Berat: <b className="text-slate-900 font-mono">{totalWeightGrams.toLocaleString("id-ID")} gr ({totalWeightKg} kg)</b>
              </div>
              <div className="text-xs text-slate-600">
                Subtotal: <b>{formatRupiah(subtotalBelanja)}</b> | Ekspedisi: <b>{activeShipping.serviceName} ({formatRupiah(activeShipping.cost)})</b>
              </div>
              <div className="text-sm font-bold text-[#9F1239] mt-0.5">
                Grand Total: {formatRupiah(grandTotal)}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold border border-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className="px-5 py-2 bg-[#9F1239] hover:bg-[#881337] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-xs transition"
              >
                {submitting ? "Menyimpan SO..." : "Konfirmasi & Simpan SO"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}