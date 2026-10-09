import React from 'react';

interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export default function AlertModal({ isOpen, title = "Pemberitahuan", message, onClose }: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#E8D1D1] text-center">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-[#D48B8B] hover:bg-[#C27676] text-white font-medium transition"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
