"use client";

import React, { useEffect, useMemo, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Product { productCode: string; name: string; sellingPrice: number; capitalPrice: number; unit: string; barcode: string; active: boolean; }
interface CartLine { productCode: string; productName: string; unit: string; capitalPrice: number; sellingPrice: number; qty: number; discountItem: number; }
interface RecentSale { saleId: string; saleDate: string; customerName: string; paymentMethod: string; totalAmount: number; status: string; }

const fmtRp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function POSView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT">("CASH");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadProducts() {
    try {
      const r = await fetch("/api/warung/products?active=true");
      const j = await r.json();
      if (j.success) setProducts(j.data);
    } catch {}
  }
  async function loadRecent() {
    try {
      const r = await fetch("/api/warung/sales");
      const j = await r.json();
      if (j.success) setRecent(j.data.slice(0, 10));
    } catch {}
  }
  useEffect(() => { loadProducts(); loadRecent(); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return products.slice(0, 20);
    const lq = q.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(lq) || p.productCode.toLowerCase().includes(lq) || p.barcode.toLowerCase().includes(lq)).slice(0, 30);
  }, [products, q]);

  function addToCart(p: Product) {
    setMsg(null);
    setCart((prev) => {
      const existing = prev.find((it) => it.productCode === p.productCode);
      if (existing) return prev.map((it) => it.productCode === p.productCode ? { ...it, qty: it.qty + 1 } : it);
      return [...prev, { productCode: p.productCode, productName: p.name, unit: p.unit, capitalPrice: p.capitalPrice, sellingPrice: p.sellingPrice, qty: 1, discountItem: 0 }];
    });
  }
  function updateQty(idx: number, qty: number) {
    if (qty <= 0) { setCart((prev) => prev.filter((_, i) => i !== idx)); return; }
    setCart((prev) => prev.map((it, i) => i === idx ? { ...it, qty } : it));
  }
  function updateDiscount(idx: number, discountItem: number) {
    setCart((prev) => prev.map((it, i) => i === idx ? { ...it, discountItem: Math.max(0, discountItem) } : it));
  }
  function removeLine(idx: number) { setCart((prev) => prev.filter((_, i) => i !== idx)); }
  function clearCart() { setCart([]); }

  const subtotal = cart.reduce((s, it) => s + (it.sellingPrice * it.qty - (it.discountItem || 0)), 0);

  async function submitSale(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) { setMsg({ type: "error", text: "Keranjang kosong." }); return; }
    if (subtotal <= 0) { setMsg({ type: "error", text: "Subtotal 0." }); return; }
    if (paymentMethod === "CREDIT" && !customerName.trim()) { setMsg({ type: "error", text: "Kredit wajib isi nama customer." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/warung/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleDate: new Date().toISOString().slice(0, 10),
          customerName: customerName.trim() || "Walk-in",
          paymentMethod,
          notes,
          items: cart.map((it) => ({ productCode: it.productCode, qty: it.qty, discountItem: it.discountItem, price: it.sellingPrice })),
        }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message + " Total " + fmtRp(j.data.totalAmount) });
      setCart([]);
      setPayOpen(false);
      setCustomerName("");
      setNotes("");
      await loadRecent();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  async function voidSale(s: RecentSale) {
    if (!confirm(`Void penjualan ${s.saleId}? Stok akan dikembalikan.`)) return;
    try {
      const res = await fetch(`/api/warung/sales/${encodeURIComponent(s.saleId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VOID" }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      await loadRecent();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
  }

  const cartColumns: Column<CartLine>[] = [
    { key: "productName", label: "Produk", render: (r) => <span className="text-[11px]"><b>{r.productName}</b><br/><span className="text-slate-500 font-mono text-[10px]">{r.productCode}</span></span> },
    { key: "qty", label: "Qty", render: (r) => {
      const idx = cart.findIndex((c) => c.productCode === r.productCode);
      return <input type="number" min={1} step={1} value={r.qty} onChange={(e) => updateQty(idx, Number(e.target.value))} className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-xs" />;
    }},
    { key: "sellingPrice", label: "Harga", render: (r) => <span className="font-mono text-[10px]">{fmtRp(r.sellingPrice)}</span> },
    { key: "discountItem", label: "Diskon", render: (r) => {
      const idx = cart.findIndex((c) => c.productCode === r.productCode);
      return <input type="number" min={0} step={1} value={r.discountItem} onChange={(e) => updateDiscount(idx, Number(e.target.value))} className="w-20 border border-slate-300 rounded px-1.5 py-0.5 text-xs" />;
    }},
    { key: "subtotal", label: "Subtotal", render: (r) => <span className="font-mono text-[11px] font-bold">{fmtRp(r.sellingPrice * r.qty - (r.discountItem || 0))}</span> },
    { key: "actions", label: "", render: (r) => {
      const idx = cart.findIndex((c) => c.productCode === r.productCode);
      return <button type="button" onClick={() => removeLine(idx)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">×</button>;
    }},
  ];

  const recentColumns: Column<RecentSale>[] = [
    { key: "saleId", label: "ID", render: (r) => <span className="font-mono font-bold text-[11px]">{r.saleId}</span> },
    { key: "saleDate", label: "Tgl", render: (r) => <span className="font-mono text-[10px]">{r.saleDate}</span> },
    { key: "totalAmount", label: "Total", render: (r) => <span className="font-mono text-[11px]">{fmtRp(r.totalAmount)}</span> },
    { key: "paymentMethod", label: "Bayar", render: (r) => <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.paymentMethod === "CASH" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.paymentMethod}</span> },
    { key: "status", label: "Status", render: (r) => <span className={r.status === "VOID" ? "text-rose-700 text-[10px] font-bold" : "text-[10px]"}>{r.status}</span> },
    { key: "actions", label: "", render: (r) => r.status === "POSTED" ? (
      <button type="button" onClick={() => voidSale(r)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">Void</button>
    ) : <span className="text-[10px] text-slate-400">-</span>},
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-900 uppercase">Pilih Produk</span>
          <span className="text-[10px] text-slate-500">{products.length} produk</span>
        </div>
        <WarungSearchInput value={q} onChange={setQ} placeholder="Cari nama/kode/barcode..." />
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {filtered.map((p) => (
            <button key={p.productCode} type="button" onClick={() => addToCart(p)} className="w-full text-left border border-slate-200 rounded-lg p-2 hover:bg-amber-50 transition">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs font-semibold text-slate-900">{p.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{p.productCode}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-700 font-mono">{fmtRp(p.sellingPrice)}</div>
                  <div className="text-[10px] text-slate-500">{p.unit}</div>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div className="p-6 text-center text-xs text-slate-400">Produk tidak ditemukan.</div>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-900 uppercase">Keranjang ({cart.length})</span>
          {cart.length > 0 && <button type="button" onClick={clearCart} className="text-[10px] text-rose-600 hover:underline">Kosongkan</button>}
        </div>

        {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

        <WarungDataTable columns={cartColumns} data={cart} rowKey={(r) => r.productCode} emptyMessage="Keranjang kosong. Klik produk di kiri." />

        <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
          <span className="text-xs font-bold uppercase">Subtotal</span>
          <span className="text-lg font-bold font-mono text-emerald-700">{fmtRp(subtotal)}</span>
        </div>

        <button type="button" disabled={cart.length === 0 || subtotal <= 0} onClick={() => setPayOpen(true)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold">
          Bayar
        </button>

        <div className="border-t border-slate-200 pt-2">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Transaksi Terakhir</div>
          <WarungDataTable columns={recentColumns} data={recent} rowKey={(r) => r.saleId} emptyMessage="Belum ada penjualan." />
        </div>
      </div>

      <WarungModal open={payOpen} title={`Pembayaran — ${fmtRp(subtotal)}`} onClose={() => setPayOpen(false)}>
        <form onSubmit={submitSale} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Metode Bayar</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaymentMethod("CASH")} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${paymentMethod === "CASH" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300"}`}>Tunai</button>
              <button type="button" onClick={() => setPaymentMethod("CREDIT")} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${paymentMethod === "CREDIT" ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-700 border-slate-300"}`}>Kredit (Bon)</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Customer {paymentMethod === "CREDIT" && <span className="text-rose-600">*wajib</span>}
            </label>
            <input type="text" required={paymentMethod === "CREDIT"} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in / nama" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="text-xs bg-slate-50 border border-slate-200 rounded p-2">
            <div className="flex justify-between"><span>Items</span><b>{cart.length}</b></div>
            <div className="flex justify-between"><span>Total</span><b className="font-mono text-emerald-700">{fmtRp(subtotal)}</b></div>
            {paymentMethod === "CREDIT" && <div className="text-[10px] text-amber-700 mt-1">Akan dibuatkan Piutang otomatis.</div>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPayOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg">{submitting ? "Memproses..." : "Bayar & Simpan"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}