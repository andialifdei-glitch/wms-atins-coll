"use client";

import React, { useState, useMemo, useEffect } from "react";
import { formatRupiah } from "@/lib/formatters";

interface SalesOrderModalProps {
  isOpen: boolean;
  editingSoId: string | null;
  customers: any[];
  products: any[];
  storeOriginId: number;
  initialCustomer: any | null;
  initialItems: any[];
  initialRates: any[];
  initialCost: number;
  initialCourier: string;
  initialService: string;
  onClose: () => void;
  onSaveSo: (payload: any) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function SalesOrderModal({
  isOpen,
  editingSoId,
  customers,
  products,
  storeOriginId,
  initialCustomer,
  initialItems,
  initialRates,
  initialCost,
  initialCourier,
  initialService,
  onClose,
  onSaveSo,
  showAlert,
}: SalesOrderModalProps) {
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(initialCustomer);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [soItems, setSoItems] = useState<any[]>(initialItems);
  const [shippingRates, setShippingRates] = useState<any[]>(initialRates);
  const [shippingCost, setShippingCost] = useState<number>(initialCost);
  const [courierCode, setCourierCode] = useState<string>(initialCourier);
  const [serviceName, setServiceName] = useState<string>(initialService);
  const [isCalculatingOngkir, setIsCalculatingOngkir] = useState(false);

  useEffect(() => {
    setSelectedCustomer(initialCustomer);
    setSoItems(initialItems);
    setShippingRates(initialRates);
    setShippingCost(initialCost);
    setCourierCode(initialCourier);
    setServiceName(initialService);
  }, [initialCustomer, initialItems, initialRates, initialCost, initialCourier, initialService]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return [];
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        (c.customerName || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.customerCode || "").toLowerCase().includes(q)
    ).slice(0, 5);
  }, [customers, customerSearchQuery]);

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return [];
    const q = productSearchQuery.toLowerCase();
    return products.filter(
      (p) =>
        (p.sku || "").toLowerCase().includes(q) ||
        (p.itemName || "").toLowerCase().includes(q)
    ).slice(0, 6);
  }, [products, productSearchQuery]);

  if (!isOpen) return null;

  async function handleCheckOngkir() {
    const destAddr = selectedCustomer?.displayAddress || selectedCustomer?.fullAddress || "";
    if (!destAddr) {
      return showAlert("Pilih customer yang memiliki alamat lengkap terlebih dahulu!", "Peringatan");
    }
    const totalWeight = Math.max(1000, soItems.reduce((acc, it) => acc + (it.weightInGrams || 0) * it.qty, 0));

    setIsCalculatingOngkir(true);
    setShippingRates([]);
    try {
      const searchRes = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEARCH_DESTINATION", queryText: destAddr }),
      });
      const searchJson = await searchRes.json();
      const destId = searchJson?.data?.[0]?.id || selectedCustomer?.rajaOngkirDestinationId || 4997;

      const couriers = ["wahana", "lion", "spx"];
      const compiledRates: any[] = [];

      for (const c of couriers) {
        try {
          const costRes = await fetch("/api/shipping/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "CALCULATE_COST",
              originId: storeOriginId || 4997,
              destinationId: destId,
              weightInGrams: totalWeight,
              courierCode: c,
            }),
          });
          const costJson = await costRes.json();
          if (costJson.status === "AVAILABLE" && Array.isArray(costJson.data)) {
            compiledRates.push(...costJson.data);
          }
        } catch (err) {}
      }

      if (compiledRates.length === 0) {
        showAlert("Tidak ditemukan tarif pengiriman dari RajaOngkir untuk rute ini.", "Info Ongkir");
      } else {
        setShippingRates(compiledRates);
        showAlert(`Berhasil memuat ${compiledRates.length} opsi ekspedisi!`);
      }
    } catch (err: any) {
      showAlert("Gagal menghitung ongkos kirim: " + (err.message || "Periksa koneksi"));
    } finally {
      setIsCalculatingOngkir(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-rose-100 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold text-rose-950 mb-1">
          {editingSoId ? `Edit SO: ${editingSoId}` : "Buat Sales Order Baru (SO)"}
        </h3>
        <p className="text-[11px] text-rose-500 font-mono mb-4">
          Pengeditan harga dilakukan langsung pada tabel barang di bawah untuk memastikan snapshot tersimpan
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedCustomer) return showAlert("Pilih customer dari database terlebih dahulu!");
            if (soItems.length === 0) return showAlert("Tambahkan minimal 1 item barang!");
            onSaveSo({
              editingSoId,
              selectedCustomer,
              soItems,
              shippingRates,
              shippingCost,
              courierCode,
              serviceName,
            });
          }}
          className="space-y-4"
        >
          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200 space-y-2">
            <label className="block text-xs font-bold text-rose-950">Cari Data Customer (Database)</label>
            <input
              type="text"
              placeholder="Ketik nama / no telp customer..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              className="w-full p-2 border border-rose-200 rounded-lg text-xs bg-white outline-none"
            />

            {filteredCustomers.length > 0 && (
              <div className="border border-rose-200 rounded-lg bg-white divide-y divide-rose-100 text-xs">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearchQuery("");
                    }}
                    className="p-2 hover:bg-rose-100/60 cursor-pointer flex justify-between"
                  >
                    <span className="font-bold">{c.customerName} ({c.phone})</span>
                    <span className="text-[11px] text-slate-500">{c.customerCode}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedCustomer ? (
              <div className="p-3 bg-white rounded-lg border border-rose-200 space-y-1 text-xs">
                <div>Nama Customer : <b className="text-rose-950">{selectedCustomer.customerName}</b></div>
                <div>No Handphone  : <b className="text-rose-950">{selectedCustomer.phone || "-"}</b></div>
                <div>Alamat Kirim  : <b className="text-rose-950">{selectedCustomer.displayAddress || selectedCustomer.fullAddress || "-"}</b></div>
              </div>
            ) : (
              <div className="text-[11px] text-red-600 font-medium">* Belum ada customer dipilih dari database.</div>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <button
              type="button"
              disabled={isCalculatingOngkir || !selectedCustomer}
              onClick={handleCheckOngkir}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold"
            >
              {isCalculatingOngkir ? "Menghitung..." : "🚚 Cek & Snapshot Ongkir RajaOngkir"}
            </button>
            {serviceName && (
              <span className="text-xs font-bold text-emerald-700">Terpilih: {serviceName} ({formatRupiah(shippingCost)})</span>
            )}
          </div>

          {shippingRates.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {shippingRates.map((r, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setShippingCost(r.cost);
                    setCourierCode(r.courier);
                    setServiceName(r.serviceName);
                  }}
                  className={`p-2 rounded-lg border text-xs cursor-pointer ${
                    serviceName === r.serviceName ? "bg-[#BE185D] text-white border-[#BE185D] font-bold" : "bg-white border-rose-200 text-rose-900"
                  }`}
                >
                  <div>{r.serviceName}</div>
                  <div className="text-[11px] mt-1">{formatRupiah(r.cost)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-2">
            <label className="block text-xs font-bold text-rose-900">Cari Produk untuk Ditambahkan</label>
            <input
              type="text"
              placeholder="Ketik SKU atau Nama Produk..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="w-full p-2 border border-rose-200 rounded-lg text-xs bg-white outline-none"
            />

            {filteredProducts.length > 0 && (
              <div className="border border-rose-200 rounded-lg bg-white divide-y divide-rose-100 text-xs">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      const existingIndex = soItems.findIndex((it) => it.sku === p.sku);
                      const price = Number(p.netPrice || 0);
                      if (existingIndex >= 0) {
                        setSoItems((prev) =>
                          prev.map((item, idx) =>
                            idx === existingIndex
                              ? { ...item, qty: item.qty + 1, subtotal: (item.qty + 1) * item.price }
                              : item
                          )
                        );
                      } else {
                        setSoItems((prev) => [
                              ...prev,
                              {
                                sku: p.sku,
                                itemName: p.itemName,
                                qty: 1,
                                price: price,
                                subtotal: price,
                                weightInGrams: p.weightInGrams || 0,
                              },
                            ]);
                      }
                      setProductSearchQuery("");
                    }}
                    className="p-2 hover:bg-rose-50 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold">{p.itemName}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">({p.sku})</span>
                    </div>
                    <span className="font-bold text-rose-900">{formatRupiah(Number(p.netPrice || 0))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto border border-rose-100 rounded-lg divide-y divide-rose-50 text-xs">
            {soItems.length === 0 ? (
              <div className="p-4 text-center text-slate-400">Belum ada produk ditambahkan ke SO.</div>
            ) : (
              soItems.map((it, idx) => (
                <div key={idx} className="p-2.5 flex justify-between items-center gap-2">
                  <div className="flex-1">
                    <div className="font-bold">{it.itemName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{it.sku}</div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) => {
                        const newQty = Math.max(1, Number(e.target.value));
                        setSoItems((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, qty: newQty, subtotal: newQty * item.price } : item))
                        );
                      }}
                      className="w-14 p-1 border border-rose-200 rounded text-center font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">Harga:</span>
                    <input
                      type="number"
                      min="0"
                      value={it.price}
                      onChange={(e) => {
                        const newPrice = Number(e.target.value);
                        setSoItems((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, price: newPrice, subtotal: item.qty * newPrice } : item))
                        );
                      }}
                      className="w-24 p-1 border border-rose-200 rounded text-center font-bold"
                    />
                  </div>

                  <div className="w-24 text-right font-bold text-emerald-600">
                    {formatRupiah(it.subtotal)}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSoItems(soItems.filter((_, i) => i !== idx))}
                    className="text-red-600 font-bold px-1.5"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-rose-100 flex justify-between items-center text-xs">
            <div>
              <span>Subtotal Produk: <b>{formatRupiah(soItems.reduce((acc, it) => acc + it.subtotal, 0))}</b></span>
              <span className="ml-3">Ongkir: <b>{formatRupiah(shippingCost)}</b></span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 bg-slate-100 rounded text-xs font-bold">Batal</button>
              <button type="submit" className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded shadow">Simpan Sales Order</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}