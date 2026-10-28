"use client";

import React, { useState } from "react";
import DivisionsView from "./master/DivisionsView";
import DepartmentsView from "./master/DepartmentsView";
import FamiliesView from "./master/FamiliesView";
import WarungPlaceholder from "./WarungPlaceholder";
import ProductsView from "./master/ProductsView";

type SubTab = "products" | "families" | "departments" | "divisions";

const TABS: { key: SubTab; label: string }[] = [
  { key: "products", label: "Produk" },
  { key: "families", label: "Family" },
  { key: "departments", label: "Departemen" },
  { key: "divisions", label: "Divisi" },
];

export default function WarungMasterRouter() {
  const [tab, setTab] = useState<SubTab>("products");

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-slate-200 pb-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === t.key ? "bg-amber-600 text-white shadow-xs" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsView />}
      {tab === "families" && <FamiliesView />}
      {tab === "departments" && <DepartmentsView />}
      {tab === "divisions" && <DivisionsView />}
    </div>
  );
}