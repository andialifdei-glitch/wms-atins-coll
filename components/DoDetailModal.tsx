'use client';

import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { printerService, LabelData, StorePrinterConfig } from '../lib/printerService';

interface DoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryOrder: any;
  currentUserName?: string;
  storeSenderData?: { store_name?: string; store_phone?: string };
}

export default function DoDetailModal({
  isOpen,
  onClose,
  deliveryOrder,
  currentUserName = 'Admin',
  storeSenderData
}: DoDetailModalProps) {
  const [printing, setPrinting] = useState(false);

  if (!isOpen || !deliveryOrder) return null;

  const handlePrintLabel = async () => {
    let storeName = storeSenderData?.store_name || '';
    let storePhone = storeSenderData?.store_phone || '';

    // Ambil dari Firestore settings jika belum ada
    if (!storeName || !storePhone) {
      try {
        const storeSnap = await getDoc(doc(db, 'settings', 'store_info'));
        if (storeSnap.exists()) {
          const d = storeSnap.data();
          storeName = storeName || d.storeName || d.store_name || d.name || d.senderName || '';
          storePhone = storePhone || d.phone || d.storePhone || d.store_phone || d.senderPhone || '';
        }
      } catch (err) {
        console.warn('Gagal membaca database setting:', err);
      }
    }

    // Fallback ke localStorage
    const rawLocal = localStorage.getItem('wms_store_printer_settings');
    let localConfig: any = {};
    if (rawLocal) {
      try { localConfig = JSON.parse(rawLocal); } catch (e) {}
    }

    const config: StorePrinterConfig = {
      store_name: storeName || localConfig.store_name || "Atin's Collection",
      store_phone: storePhone || localConfig.store_phone || '-',
      paper_size: localConfig.paper_size || '80mm'
    };

    const labelPayload: LabelData = {
      do_number: deliveryOrder.do_number || deliveryOrder.doId || deliveryOrder.id || '-',
      expedition: deliveryOrder.expedition || '-',
      recipient_name: deliveryOrder.recipient_name || deliveryOrder.recipientName || '-',
      recipient_address: deliveryOrder.recipient_address || deliveryOrder.recipientAddress || '-',
      recipient_phone: deliveryOrder.recipient_phone || deliveryOrder.recipientPhone || '-',
      so_number: deliveryOrder.so_number || deliveryOrder.soId || '-',
      printed_by: currentUserName
    };

    try {
      setPrinting(true);
      await printerService.print(labelPayload, config);
      alert('Label berhasil dikirim ke printer!');
    } catch (err: any) {
      alert('Gagal cetak label: ' + (err?.message || err));
    } finally {
      setPrinting(false);
    }
  };

  const items = Array.isArray(deliveryOrder.items) ? deliveryOrder.items : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-rose-100">
        <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-rose-950">Detail Delivery Order</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-gray-700">
          <div className="grid grid-cols-2 gap-3 bg-rose-50/40 p-3.5 rounded-lg border border-rose-100">
            <div>
              <span className="text-gray-500 block">No. DO:</span>
              <span className="font-mono font-bold text-rose-900">{deliveryOrder.do_number || deliveryOrder.doId || deliveryOrder.id}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Ref SO:</span>
              <span className="font-mono font-medium">{deliveryOrder.so_number || deliveryOrder.soId || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Ekspedisi:</span>
              <span className="font-medium">{deliveryOrder.expedition || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Penerima:</span>
              <span className="font-medium">{deliveryOrder.recipient_name || deliveryOrder.recipientName || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">No. Handphone:</span>
              <span>{deliveryOrder.recipient_phone || deliveryOrder.recipientPhone || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Total Qty:</span>
              <span className="font-bold">{deliveryOrder.totalPcs || 0} pcs</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 block">Alamat Pengiriman:</span>
              <span className="leading-relaxed">{deliveryOrder.recipient_address || deliveryOrder.recipientAddress || '-'}</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-rose-950 mb-2">Daftar Item Barang ({items.length})</h4>
            <div className="border border-rose-100 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-rose-50 text-rose-900 font-bold border-b border-rose-100">
                  <tr>
                    <th className="p-2">Produk</th>
                    <th className="p-2 text-center">Ukuran / Varian</th>
                    <th className="p-2 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-3 text-center text-gray-400">Tidak ada rincian item</td>
                    </tr>
                  ) : (
                    items.map((it: any, idx: number) => {
                      const itemName =
                        it.productName ||
                        it.product_name ||
                        it.itemName ||
                        it.item_name ||
                        it.namaProduk ||
                        it.nama_produk ||
                        it.name ||
                        it.title ||
                        '-';

                      const itemSku = it.sku || it.productId || it.product_id || it.barcode || '';
                      const itemVariant = it.size || it.variant || it.color || '-';
                      const itemQty = it.qty || it.quantity || it.pcs || 0;

                      return (
                        <tr key={idx}>
                          <td className="p-2">
                            <div className="font-semibold text-gray-800">{itemName}</div>
                            {itemSku && <div className="text-[10px] text-gray-400 font-mono">{itemSku}</div>}
                          </td>
                          <td className="p-2 text-center">{itemVariant}</td>
                          <td className="p-2 text-center font-bold text-rose-900">{itemQty} pcs</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrintLabel}
            disabled={printing}
            className="px-4 py-2 rounded-lg bg-[#BE185D] hover:bg-rose-800 text-white font-bold disabled:opacity-50 transition"
          >
            {printing ? 'Mencetak Label...' : 'Cetak Label Bluetooth'}
          </button>
        </div>
      </div>
    </div>
  );
}
