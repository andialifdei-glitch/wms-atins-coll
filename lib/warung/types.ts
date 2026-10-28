/**
 * Kontrak tipe domain Warung.
 * Tidak ada dummy data — interfaces only.
 * Ditambah bertahap per tahap implementasi.
 */

export type WarungRole = "ROOT_ADMIN" | "ADMIN_WARUNG" | "KASIR" | "STAFF_WARUNG";

export interface WarungUserSession {
  uid: string;
  id: string;
  email: string;
  role: WarungRole;
  name: string;
}

export type WarungTabKey =
  | "warung_dashboard"
  | "warung_pos"
  | "warung_products"
  | "warung_suppliers"
  | "warung_stock"
  | "warung_stock_card"
  | "warung_stock_opname"
  | "warung_adjustment_ip"
  | "warung_breakage"
  | "warung_po"
  | "warung_receiving"
  | "warung_returns"
  | "warung_cash_count"
  | "warung_cash_flow"
  | "warung_receivables"
  | "warung_payables"
  | "warung_coa"
  | "warung_journals"
  | "warung_reports"
  | "warung_settings"
  | "warung_fiscal_periods"
  | "warung_income_statement"
  | "warung_balance_sheet";