"use client";
import React, { useState, useEffect } from "react";

interface ReceivingModalProps {
  isOpen: boolean;
  selectedPo: any | null;
  availablePos?: any[];
  onSelectPo?: (po: any) => void;
  onClose: () => void;
  onExecuteReceiving: (payload: { po: any; receivedMap: Record<string, number>; notes: string }) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function ReceivingModal({
  isOpen,
  selectedPo,
  availablePos = [],
  onSelectPo,
  onClose,
  onExecuteReceiving,
  showAlert,
}: ReceivingModalProps) {
  const [receivedInputs, setReceivedInputs] = useState<Record<string, number>>({});
  const [receivingNotes, setReceivingNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    setReceivedInputs({});
    setReceivingNotes("");
    setIsConfirmOpen(false);
  }, [selectedPo?.id, selectedPo?.poId]);

  if (!isOpen || !selectedPo) return null;

  const items = selectedPo.items || [];

  function handleSubmitCheck(e: React.FormEvent) {
    e.preventDefault();
    let hasAny = false;

    for (const it of items) {
      const remaining = Math.max(0, Number(it.qty || 0) - Number(it.receivedQty || 0));
      const val = Number(receivedInputs[it.sku] || 0);

      if (val > 0) hasAny = true;
      if (val > remaining) {
        return showAlert(
          "Jumlah untuk " + it.itemName + " (" + val + " pcs) melebihi sisa pesanan (" + remaining + " pcs)!",
          "Validasi Receiving"
        );
      }
    }

    if (!hasAny) {
      return showAlert("Isi minimal satu barang dengan kuantitas lebih dari 0!");
    }
    setIsConfirmOpen(true);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-rose-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold text-rose-950">Penerimaan Barang Fisik (Receiving)</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-base">✕</button>
          </div>

          <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-100 mb-4 space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-rose-900 mb-1">Pilih Nomor Purchase Order (PO):</label>
              {availablePos.length > 1 ? (
                <select
                  value={selectedPo.poId || selectedPo.id}
                  onChange={(e) => {
                    const target = availablePos.find((p) => (p.poId || p.id) === e.target.value);
                    if (target && onSelectPo) onSelectPo(target);
                  }}
                  className="w-full p-2 border border-rose-200 rounded-lg bg-white font-mono font-bold text-rose-900 outline-none text-xs"
                >
                  {availablePos.map((p) => (
                    <option key={p.id || p.poId} value={p.poId || p.id}>
                      {p.poId || p.documentNo} - Supplier: {p.supplier} ({p.status})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-mono font-bold text-rose-900 bg-white p-2 border border-rose-200 rounded-lg">
                  {selectedPo.poId || selectedPo.documentNo}
                </div>
              )}
            </div>

            <div className="flex justify-between text-[11px] text-slate-600 pt-1">
              <span>Supplier: <b className="text-rose-950">{selectedPo.supplier || "-"}</b></span>
              <span>Status PO: <b className="text-emerald-700">{selectedPo.status}</b></span>
            </div>
          </div>

          <form onSubmit={handleSubmitCheck} className="space-y-3.5 text-xs">
            <label className="block font-semibold text-rose-950">Daftar Barang Sesuai PO:</label>
            <div className="max-h-56 overflow-y-auto border border-rose-100 rounded-lg divide-y divide-rose-50">
              {items.map((it: any) => {
                const sisa = Math.max(0, Number(it.qty || 0) - Number(it.receivedQty || 0));
                return (
                  <div key={it.sku} className="p-2.5 flex justify-between items-center gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-rose-950">{it.itemName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Dipesan: {it.qty} | Sisa Belum Datang: <b className="text-blue-700">{sisa} pcs</b>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">Qty Masuk:</span>
                      <input
                        type="number"
                        min="0"
                        max={sisa}
                        placeholder="0"
                        value={receivedInputs[it.sku] ?? ""}
                        onChange={(e) => setReceivedInputs({ ...receivedInputs, [it.sku]: Number(e.target.value) })}
                        disabled={sisa === 0}
                        className="w-16 p-1 border border-rose-200 rounded text-center font-bold outline-none disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block font-semibold text-rose-900 mb-1">Catatan Penerimaan</label>
              <input
                type="text"
                placeholder="misal: Barang diterima lengkap dan sesuai spesifikasi"
                value={receivingNotes}
                onChange={(e) => setReceivingNotes(e.target.value)}
                className="w-full p-2 border border-rose-200 rounded-lg outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-rose-100">
              <button type="button" onClick={onClose} className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold">Batal</button>
              <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow">Proses Penerimaan</button>
            </div>
          </form>
        </div>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-emerald-200 text-center">
            <h3 className="text-base font-bold text-emerald-950 mb-2">Konfirmasi Penerimaan Barang</h3>

            <div className="text-xs text-left bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 mb-4 max-h-40 overflow-y-auto space-y-1">
              {items.filter((it: any) => Number(receivedInputs[it.sku] || 0) > 0).map((it: any) => (
                <div key={it.sku} className="flex justify-between">
                  <span>{it.itemName}:</span>
                  <b className="text-emerald-800">{receivedInputs[it.sku]} pcs</b>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">Cek Ulang</button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmOpen(false);
                  onExecuteReceiving({ po: selectedPo, receivedMap: receivedInputs, notes: receivingNotes });
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow"
              >
                OK, Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}