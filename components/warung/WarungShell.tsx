"use client";

import React, { useEffect, useState } from "react";
import type { WarungTabKey } from "@/lib/warung/types";
import WarungPlaceholder from "./WarungPlaceholder";
import WarungMasterRouter from "./WarungMasterRouter";
import SuppliersView from "./master/SuppliersView";
import StocksView from "./inventory/StocksView";
import StockCardView from "./inventory/StockCardView";
import StockOpnameView from "./inventory/StockOpnameView";
import AdjustmentIpView from "./inventory/AdjustmentIpView";
import BreakageView from "./inventory/BreakageView";
import PurchaseOrderView from "./purchasing/PurchaseOrderView";
import ReceivingView from "./purchasing/ReceivingView";
import PurchaseReturnsView from "./purchasing/PurchaseReturnsView";
import CashCountView from "./finance/CashCountView";
import CoaView from "./finance/CoaView";
import JournalsView from "./finance/JournalsView";
import CashFlowsView from "./finance/CashFlowsView";
import ReceivablesView from "./finance/ReceivablesView";
import PayablesView from "./finance/PayablesView";
import FiscalPeriodsView from "./finance/FiscalPeriodsView";
import IncomeStatementView from "./finance/IncomeStatementView";
import BalanceSheetView from "./finance/BalanceSheetView";
import ReportsRouter from "./reports/ReportsRouter";
import SettingsView from "./settings/SettingsView";
import WarungDashboardView from "./WarungDashboardView";
import POSView from "./POSView";

interface WarungShellProps {
  initialTab?: WarungTabKey;
}

const MODULES: { key: WarungTabKey; label: string; group: string }[] = [
  { key: "warung_dashboard", label: "Dashboard Warung", group: "Overview" },
  { key: "warung_pos", label: "Kasir / POS", group: "Penjualan" },
  { key: "warung_products", label: "Master Produk", group: "Persediaan" },
  { key: "warung_suppliers", label: "Supplier", group: "Persediaan" },
  { key: "warung_stock", label: "Stock", group: "Persediaan" },
  { key: "warung_stock_card", label: "Kartu Stock", group: "Persediaan" },
  { key: "warung_stock_opname", label: "Stock Opname", group: "Persediaan" },
  { key: "warung_adjustment_ip", label: "Adjustment (IP)", group: "Persediaan" },
  { key: "warung_breakage", label: "Breakage / Susut", group: "Persediaan" },
  { key: "warung_po", label: "Purchase Order", group: "Purchasing" },
  { key: "warung_receiving", label: "Receiving", group: "Purchasing" },
  { key: "warung_returns", label: "Retur Pembelian", group: "Purchasing" },
  { key: "warung_cash_count", label: "Cash Count", group: "Keuangan" },
  { key: "warung_cash_flow", label: "Kas Masuk / Keluar", group: "Keuangan" },
  { key: "warung_receivables", label: "Piutang", group: "Keuangan" },
  { key: "warung_payables", label: "Utang", group: "Keuangan" },
  { key: "warung_coa", label: "Chart of Accounts", group: "Akuntansi" },
  { key: "warung_journals", label: "Jurnal Umum", group: "Akuntansi" },
  { key: "warung_income_statement", label: "Laba Rugi", group: "Akuntansi" },
  { key: "warung_balance_sheet", label: "Neraca", group: "Akuntansi" },
  { key: "warung_fiscal_periods", label: "Tutup Periode", group: "Akuntansi" },
  { key: "warung_reports", label: "Laporan", group: "Laporan" },
  { key: "warung_settings", label: "Pengaturan Warung", group: "Pengaturan" },
];

export default function WarungShell({ initialTab }: WarungShellProps) {
  const [activeTab, setActiveTab] = useState<WarungTabKey>(initialTab || "warung_dashboard");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const activeModule = MODULES.find((m) => m.key === activeTab);
  const activeLabel = activeModule?.label || "Dashboard Warung";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Operasional Warung</h2>
          <p className="text-[11px] text-slate-500">Modul: <b className="text-slate-900">{activeLabel}</b></p>
        </div>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-700 px-2 py-1 rounded border border-emerald-500/30 font-bold uppercase">
          Project: operasional-warung
        </span>
      </div>

      <div>
        {activeTab === "warung_products" ? (
          <WarungMasterRouter />
        ) : activeTab === "warung_suppliers" ? (
          <SuppliersView />
        ) : activeTab === "warung_stock" ? (
          <StocksView />
        ) : activeTab === "warung_stock_card" ? (
          <StockCardView />
        ) : activeTab === "warung_stock_opname" ? (
          <StockOpnameView />
        ) : activeTab === "warung_adjustment_ip" ? (
          <AdjustmentIpView />
        ) : activeTab === "warung_breakage" ? (
          <BreakageView />
        ) : activeTab === "warung_po" ? (
          <PurchaseOrderView />
        ) : activeTab === "warung_receiving" ? (
          <ReceivingView />
        ) : activeTab === "warung_returns" ? (
          <PurchaseReturnsView />
        ) : activeTab === "warung_cash_count" ? (
          <CashCountView />
        ) : activeTab === "warung_coa" ? (
          <CoaView />
        ) : activeTab === "warung_journals" ? (
          <JournalsView />
        ) : activeTab === "warung_cash_flow" ? (
          <CashFlowsView />
        ) : activeTab === "warung_receivables" ? (
          <ReceivablesView />
        ) : activeTab === "warung_payables" ? (
          <PayablesView />
        ) : activeTab === "warung_fiscal_periods" ? (
          <FiscalPeriodsView />
        ) : activeTab === "warung_income_statement" ? (
          <IncomeStatementView />
        ) : activeTab === "warung_balance_sheet" ? (
          <BalanceSheetView />
        ) : activeTab === "warung_reports" ? (
          <ReportsRouter />
        ) : activeTab === "warung_settings" ? (
          <SettingsView />
        ) : activeTab === "warung_pos" ? (
          <POSView />
        ) : activeTab === "warung_dashboard" ? (
          <WarungDashboardView />
        ) : activeModule ? (
          <WarungPlaceholder
            title={activeModule.label}
            description={`Modul ${activeModule.label} akan diimplementasikan pada tahap berikutnya.`}
          />
        ) : null}
      </div>
    </div>
  );
}