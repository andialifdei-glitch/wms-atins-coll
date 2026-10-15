"use client";
import React, { useState, useMemo } from "react";

interface StockOpnameModalProps {
  isOpen: boolean;
  products: any[];
  families: any[];
  currentUserName: string;
  onClose: () => void;
  onConfirmInit: (sopTypeMode: "GENERAL" | "PARTIAL", targetProducts: any[], notes: string) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function StockOpnameModal({
  isOpen,
  products,
  families,
  currentUserName,
  onClose,
  onConfirmInit,
  showAlert,
}: StockOpnameModalProps) {
  const [sopTypeMode, setSopTypeMode] = useState<"GENERAL" | "PARTIAL">("GENERAL");
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const filteredSearchProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.active === true &&
        !selectedSkus.includes(p.sku) &&
        ((p.sku || "").toLowerCase().includes(q) || (p.itemName || "").toLowerCase().includes(q))
    ).slice(0, 6);
  }, [products, searchQuery, selectedSkus]);

  const resolvedPartialProducts = useMemo(() => {
    const list: any[] = [];
    products.forEach((p) => {
      if (p.active === true && selectedFamilies.includes(p.familyCode)) {
        if (!list.some((item) => item.sku === p.sku)) list.push(p);
      }
    });
    selectedSkus.forEach((sku) => {
      const p = products.find((prod) => prod.sku === sku);
      if (p && !list.some((item) => item.sku === p.sku)) list.push(p);
    });
    return list;
  }, [products, selectedFamilies, selectedSkus]);

  if (!isOpen) return null;

  const totalSkus = sopTypeMode === "GENERAL"
    ? products.filter((p) => p.active === true).length
    : resolvedPartialProducts.length;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-rose-100 max-h-[90vh] overflow-y-auto">
          <h3 className="text-base font-bold text-rose-950 mb-1">Inisialisasi Stock Opname Baru</h3>
          <p className="text-xs text-rose-500 font-mono mb-4">Format Dokumen: SOP-YYYYMMDD-XXX</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (sopTypeMode === "PARTIAL" && resolvedPartialProducts.length === 0) {
                return showAlert("Untuk mode Parsial, pilih minimal 1 Family atau 1 Item SKU!");
              }
              setIsConfirmOpen(true);
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block font-bold text-rose-900 mb-1">Pilih Kriteria Audit</label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setSopTypeMode("GENERAL")}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    sopTypeMode === "GENERAL" ? "bg-rose-50 border-[#BE185D] text-rose-950 font-bold shadow-xs" : "border-rose-200 text-slate-600 bg-white"
                  }`}
                >
                  <div className="text-xs">📦 General Opname</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-1">
                    Audit seluruh item produk aktif ({products.filter((p) => p.active === true).length} SKU)
                  </div>
                </div>

                <div
                  onClick={() => setSopTypeMode("PARTIAL")}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    sopTypeMode === "PARTIAL" ? "bg-rose-50 border-[#BE185D] text-rose-950 font-bold shadow-xs" : "border-rose-200 text-slate-600 bg-white"
                  }`}
                >
                  <div className="text-xs">🎯 Parsial Opname</div>
                  <div className="text-[10px] font-normal text-slate-500 mt-1">
                    Audit item tertentu berbasis Family atau Item lepasan
                  </div>
                </div>
              </div>
            </div>

            {sopTypeMode === "PARTIAL" && (
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 space-y-3">
                <div>
                  <label className="block font-bold text-rose-900 mb-1">Sertakan Berdasarkan Family</label>
                  <div className="max-h-28 overflow-y-auto border border-rose-200 rounded-lg p-2 bg-white space-y-1">
                    {families.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 cursor-pointer hover:bg-rose-50/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedFamilies.includes(f.familyCode)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFamilies([...selectedFamilies, f.familyCode]);
                            } else {
                              setSelectedFamilies(selectedFamilies.filter((c) => c !== f.familyCode));
                            }
                          }}
                          className="rounded text-[#BE185D]"
                        />
                        <span className="font-medium text-slate-800">{f.familyName}</span>
                        <span className="font-mono text-[10px] text-slate-400">({f.familyCode})</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-rose-900 mb-1">Sertakan Item SKU Tertentu (Di Luar Family)</label>
                  <input
                    type="text"
                    placeholder="Ketik SKU atau Nama Produk..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-2 border border-rose-200 rounded-lg bg-white outline-none"
                  />

                  {filteredSearchProducts.length > 0 && (
                    <div className="border border-rose-200 rounded-lg bg-white divide-y divide-rose-100 mt-1">
                      {filteredSearchProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedSkus([...selectedSkus, p.sku]);
                            setSearchQuery("");
                          }}
                          className="p-1.5 hover:bg-rose-50 cursor-pointer flex justify-between"
                        >
                          <span className="font-bold">{p.itemName} ({p.sku})</span>
                          <span className="text-[10px] text-emerald-600 font-bold">+ Tambahkan</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-bold text-slate-700 mb-1">Total {resolvedPartialProducts.length} SKU Terpilih:</div>
                  <div className="max-h-24 overflow-y-auto border border-rose-100 rounded-lg p-2 bg-white divide-y divide-rose-50">
                    {resolvedPartialProducts.map((p) => (
                      <div key={p.sku} className="py-1 flex justify-between items-center text-[11px]">
                        <span>{p.itemName} ({p.sku})</span>
                        {selectedSkus.includes(p.sku) && (
                          <button
                            type="button"
                            onClick={() => setSelectedSkus(selectedSkus.filter((s) => s !== p.sku))}
                            className="text-red-600 font-bold ml-2"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    {resolvedPartialProducts.length === 0 && (
                      <div className="text-slate-400 text-center py-2">Belum ada item dipilih.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Catatan Dokumen (Opsional)</label>
              <input
                type="text"
                placeholder="misal: Audit fisik bulanan gudang utama"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#BE185D] hover:bg-[#9D174D] text-white rounded-lg font-bold shadow"
              >
                Lanjut & Konfirmasi
              </button>
            </div>
          </form>
        </div>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-rose-200 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
              📋
            </div>
            <h3 className="text-base font-bold text-rose-950 mb-2">Konfirmasi Stock Opname</h3>
            <p className="text-xs text-rose-900 mb-4 leading-relaxed text-left bg-rose-50 p-3 rounded-lg border border-rose-100">
              Kriteria Audit: <b>{sopTypeMode === "GENERAL" ? "General (Semua Item)" : "Parsial"}</b><br />
              Total Item: <b>{totalSkus} SKU Aktif</b><br />
              Petugas: <b>{currentUserName}</b>
            </p>
            <p className="text-xs text-slate-600 mb-6 font-medium">
              Apakah Anda yakin ingin menginisialisasi dokumen Stock Opname ini? Saldo sistem saat ini akan dipotret sebagai snapshot.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cek Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmOpen(false);
                  onConfirmInit(sopTypeMode, sopTypeMode === "GENERAL" ? [] : resolvedPartialProducts, notes);
                }}
                className="px-5 py-2 bg-[#BE185D] hover:bg-[#9D174D] text-white text-xs font-bold rounded-xl shadow"
              >
                OK, Inisialisasi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}