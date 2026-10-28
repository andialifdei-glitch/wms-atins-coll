"use client";

import React from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function WarungSearchInput({ value, onChange, placeholder, className }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Cari..."}
      className={`flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-500 ${className || ""}`}
    />
  );
}