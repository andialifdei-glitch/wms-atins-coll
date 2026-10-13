"use client";

import React from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportExportControlsProps {
  reportTitle: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  data: any[];
  columns: { header: string; dataKey: string; format?: (val: any) => string }[];
}

export default function ReportExportControls({
  reportTitle,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  data,
  columns,
}: ReportExportControlsProps) {

  // Export to Excel (.xlsx)
  function handleExportExcel() {
    if (data.length === 0) {
      alert("Tidak ada data untuk diekspor!");
      return;
    }

    const exportRows = data.map((item, idx) => {
      const row: Record<string, any> = { No: idx + 1 };
      columns.forEach((col) => {
        const rawVal = item[col.dataKey];
        row[col.header] = col.format ? col.format(rawVal) : rawVal ?? "-";
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");

    const dateSuffix = startDate || endDate ? `_${startDate || "Awal"}_sd_${endDate || "Akhir"}` : "";
    const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, "_")}${dateSuffix}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  // Export to PDF
  function handleExportPDF() {
    if (data.length === 0) {
      alert("Tidak ada data untuk diekspor!");
      return;
    }

    const doc = new jsPDF("p", "pt", "a4");

    // Header Laporan
    doc.setFontSize(14);
    doc.text(reportTitle.toUpperCase(), 40, 40);

    doc.setFontSize(9);
    doc.setTextColor(100);
    const periodeText = startDate || endDate 
      ? `Periode: ${startDate || "Awal"} s/d ${endDate || "Sekarang"}` 
      : "Periode: Seluruh Data";
    doc.text(periodeText, 40, 55);
    doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 40, 68);

    // Table Data
    const tableHeaders = ["No", ...columns.map((col) => col.header)];
    const tableBody = data.map((item, idx) => [
      idx + 1,
      ...columns.map((col) => {
        const rawVal = item[col.dataKey];
        return col.format ? col.format(rawVal) : rawVal ?? "-";
      }),
    ]);

    autoTable(doc, {
      startY: 80,
      head: [tableHeaders],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: [190, 24, 93], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 4 },
      alternateRowStyles: { fillColor: [255, 245, 246] },
    });

    const dateSuffix = startDate || endDate ? `_${startDate || "Awal"}_sd_${endDate || "Akhir"}` : "";
    const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, "_")}${dateSuffix}.pdf`;
    doc.save(filename);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
      {/* Filter Tanggal */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-rose-950">Periode:</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="p-1.5 border border-rose-200 rounded-lg bg-white outline-none text-slate-700"
        />
        <span className="text-slate-400">s/d</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="p-1.5 border border-rose-200 rounded-lg bg-white outline-none text-slate-700"
        />
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              onStartDateChange("");
              onEndDateChange("");
            }}
            className="text-[11px] text-rose-700 underline font-medium hover:text-rose-900 ml-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Tombol Ekspor */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
        >
          <span>📊</span> Ekspor Excel (.xlsx)
        </button>
        <button
          type="button"
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
        >
          <span>📄</span> Ekspor PDF
        </button>
      </div>
    </div>
  );
}