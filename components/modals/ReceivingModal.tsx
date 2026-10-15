"use client";
import React, { useState } from "react";

interface ReceivingModalProps {
  isOpen: boolean;
  selectedPo: any | null;
  onClose: () => void;
  onExecuteReceiving: (payload: { po: any; receivedMap: Record<string, number>; notes: string }) => void;
  showAlert: (msg: string, title?: string) => void;
}

export default function ReceivingModal({
  isOpen,
  selectedPo,
  onClose,
  onExecuteReceiving,
  showAlert,
}: ReceivingModalProps) {
  const [receivedInputs, setReceivedInputs] = useState<Record<string, number>>({});
  const [receivingNotes, setReceivingNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!isOpen || !selectedPo) return null;

  const items = selectedPo.items || [];

  function handleSubmitCheck(e: React.FormEvent) {
    e.preventDefault();

    let hasAnyReceived = false;
    // Validasi Logic: Jika input > sisa pesanan maka tolak
    for (const it of items) {
      const remainingQty = Math.max(0, Number(it.qty || 0) - Number(it.receivedQty || 0));
      const inputQty = Number(receivedInputs[it.sku] || 0);

      if (inputQty > 0) {
        hasAnyReceived = true;
      }

      if (inputQty > remainingQty) {
        return showAlert(
          `Jumlah penerimaan untuk barang "${it.itemName}" (${inputQty} pcs) melebihi sisa pesanan (${remainingQty} pcs)! PO tidak dapat diterima dan harus dicek kembali.`,
          "Peringatan Validasi Receiving"
        );
      }
    }

    if (!hasAnyReceived) {
      return showAlert("Isi jumlah barang yang diterima (minimal 1 barang > 0)!");
    }

    setIsConfirmOpen(true);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-rose-100">
          <h3 className="text-base font-bold text-rose-950 mb-1">Penerimaan Barang Fisik (Receiving)</h3>
          <p className="text-xs text-rose-600 font-mono mb-4">No. PO: {selectedPo.poId || selectedPo.documentNo}</p>

          <form onSubmit={handleSubmitCheck} className="space-y-3.5 text-xs">
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
                      <span className="font-semibold text-slate-600">Qty Diterima:</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={receivedInputs[it.sku] ?? ""}
                        onChange={(e) =>
                          setReceivedInputs({
                            ...receivedInputs,
                            [it.sku]: Number(e.target.value),
                          })
                        }
                        className="w-16 p-1 border border-rose-200 rounded text-center font-bold outline-none"
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
                placeholder="misal: Barang diterima dalam kondisi baik"
                value={receivingNotes}
                onChange={(e) => setReceivingNotes(e.target.value)}
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
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow"
              >
                Proses Penerimaan
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Pop-up Alert Konfirmasi Rincian Qty yang Telah Diinput */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-emerald-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
              📥
            </div>
            <h3 className="text-base font-bold text-emerald-950 mb-2">Konfirmasi Penerimaan Barang</h3>

            <div className="text-xs text-left bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 mb-4 max-h-40 overflow-y-auto space-y-1">
              <div className="font-bold text-emerald-900 border-b border-emerald-200 pb-1 mb-1">
                Rincian Barang yang Diterima:
              </div>
              {items
                .filter((it: any) => Number(receivedInputs[it.sku] || 0) > 0)
                .map((it: any) => (
                  <div key={it.sku} className="flex justify-between">
                    <span>{it.itemName}:</span>
                    <b className="text-emerald-800">{receivedInputs[it.sku]} pcs</b>
                  </div>
                ))}
            </div>

            <p className="text-[11px] text-slate-600 mb-5 leading-relaxed">
              Catatan: Jika barang yang diterima kurang dari pesanan, barang tetap dapat diterima dan status PO ini akan
              dinyatakan <b>COMPLETED (Selesai)</b>.
            </p>

            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cek Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmOpen(false);
                  onExecuteReceiving({
                    po: selectedPo,
                    receivedMap: receivedInputs,
                    notes: receivingNotes,
                  });
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow"
              >
                OK, Terima Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}