"use client";

import React from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export default function WarungModal({ open, title, onClose, children, footer, maxWidth = "max-w-md" }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} p-6 max-h-[92vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg font-bold leading-none">×</button>
        </div>
        <div className="text-xs">{children}</div>
        {footer && <div className="mt-4 pt-3 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}