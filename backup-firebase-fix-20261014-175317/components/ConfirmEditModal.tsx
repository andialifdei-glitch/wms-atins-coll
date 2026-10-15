'use client';
import { useState, useEffect } from 'react';

interface ConfirmEditModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmEditModal({ isOpen, onConfirm, onCancel }: ConfirmEditModalProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(10);
      return;
    }

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-[#E8D1D1]">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-full text-lg">⚠️</div>
          <h3 className="text-lg font-bold text-gray-800">Konfirmasi Perubahan</h3>
        </div>

        <p className="text-sm text-gray-600 mb-2 font-medium">
          Apakah perubahan sudah sesuai ?
        </p>
        <p className="text-xs text-red-500 mb-6 bg-red-50 p-2.5 rounded-lg border border-red-100">
          Perhatian: Anda sedang memodifikasi data kredensial/katalog produk. Verifikasi kembali sebelum menekan OK.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            Batal
          </button>
          
          <button
            type="button"
            disabled={countdown > 0}
            onClick={onConfirm}
            className={`px-5 py-2 rounded-xl text-sm font-medium text-white transition ${
              countdown > 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#D48B8B] hover:bg-[#C27676]'
            }`}
          >
            {countdown > 0 ? "OK (" + countdown + "s)" : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
