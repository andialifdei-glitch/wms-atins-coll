"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";

interface OpnameHead {
  opnameId: string;
  status: string;
  snapshotAt: string;
  reviewedBy: string;
  postedBy: string;
  totalItems: number;
  totalDiffValue: number;
  notes: string;
  createdAt: string;
  createdBy: string;
}

interface OpnameItem {
  itemId: string;
  opnameId: string;
  productCode: string;
  productName: string;
  systemQty: number;
  physicalQty: number;
  diffQty: number;
  cost: number;
  diffValue: number;
}

export default function StockOpnameView() {
  const [list, setList] = useState<OpnameHead[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createNotes, setCreateNotes] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailHead, setDetailHead] = useState<OpnameHead | null>(null);
  const [detailItems, setDetailItems] = useState<OpnameItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/warung/stock-opname", { cache: "no-store" });
      const j = await res.json();
      if (j.success) setList(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailItems([]);
    setDetailHead(null);
    try {
      const res = await fetch(`/api/warung/stock-opname/${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await res.json();
      if (j.success) { setDetailHead(j.data.head); setDetailItems(j.data.items); }
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setDetailLoading(false); }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/warung/stock-opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: createNotes }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      setCreateOpen(false);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setCreateSubmitting(false); }
  }

  async function updatePhysical(item: OpnameItem, physicalQty: number) {
    if (!detailHead) return;
    try {
      const res = await fetch(`/api/warung/stock-opname/${encodeURIComponent(detailHead.opnameId)}/items/${encodeURIComponent(item.itemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ physicalQty }),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      await openDetail(detailHead.opnameId);
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
  }

  async function doAction(action: "REVIEW" | "POST" | "DELETE") {
    if (!detailHead) return;
    setActionSubmitting(true);
    try {
      let res: Response;
      if (action === "DELETE") {
        res = await fetch(`/api/warung/stock-opname/${encodeURIComponent(detailHead.opnameId)}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/warung/stock-opname/${encodeURIComponent(detailHead.opnameId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      }
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message });
      if (action === "DELETE") setDetailOpen(false);
      else await openDetail(detailHead.opnameId);
      await load();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setActionSubmitting(false); }
  }

  const columns: Column<OpnameHead>[] = [
    { key: "opnameId", label: "Opname ID", render: (r) => <span className="font-mono font-bold text-slate-900">{r.opnameId}</span> },
    { key: "status", label: "Status", render: (r) => {
      const color = r.status === "POSTED" ? "bg-emerald-100 text-emerald-800" : r.status === "REVIEW" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800";
      return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>{r.status}</span>;
    }},
    { key: "totalItems", label: "Items" },
    { key: "totalDiffValue", label: "Selisih Rp", render: (r) => <span className="font-mono text-[11px]">Rp {(r.totalDiffValue || 0).toLocaleString("id-ID")}</span> },
    { key: "createdAt", label: "Dibuat", render: (r) => <span className="text-[10px] font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"}</span> },
    { key: "actions", label: "Aksi", render: (r) => (
      <button type="button" onClick={() => openDetail(r.opnameId)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Buka</button>
    )},
  ];

  const itemColumns: Column<OpnameItem>[] = [
    { key: "productCode", label: "Kode", render: (r) => <span className="font-mono font-bold text-slate-900">{r.productCode}</span> },
    { key: "productName", label: "Nama" },
    { key: "systemQty", label: "Sistem", render: (r) => <span className="font-mono">{r.systemQty}</span> },
    { key: "physicalQty", label: "Fisik", render: (r) => (
      <input type="number" step={1} defaultValue={r.physicalQty} onBlur={(e) => {
        const v = Number(e.target.value);
        if (v !== r.physicalQty) updatePhysical(r, v);
      }} disabled={detailHead?.status === "POSTED"} className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono" />
    )},
    { key: "diffQty", label: "Diff", render: (r) => <span className={`font-mono font-bold ${r.diffQty > 0 ? "text-emerald-700" : r.diffQty < 0 ? "text-rose-700" : "text-slate-500"}`}>{r.diffQty > 0 ? "+" : ""}{r.diffQty}</span> },
    { key: "diffValue", label: "Nilai", render: (r) => <span className="font-mono text-[11px]">Rp {(r.diffValue || 0).toLocaleString("id-ID")}</span> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Stock Opname</span>
          <p className="text-[11px] text-slate-500">Snapshot & penyelarasan stok fisik</p>
        </div>
        <button type="button" onClick={() => { setCreateNotes(""); setCreateOpen(true); }} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Buat Opname</button>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={list} loading={loading} rowKey={(r) => r.opnameId} emptyMessage="Belum ada opname." />

      <WarungModal open={createOpen} title="Buat Stock Opname" onClose={() => setCreateOpen(false)}>
        <form onSubmit={submitCreate} className="space-y-3">
          <p className="text-xs text-slate-600">Opname akan membuat snapshot semua produk aktif FISIK dengan qty sistem saat ini. Anda bisa sesuaikan qty fisik setelahnya.</p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan (opsional)</label>
            <input type="text" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} disabled={createSubmitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={createSubmitting} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg">{createSubmitting ? "Menyimpan..." : "Buat"}</button>
          </div>
        </form>
      </WarungModal>

      <WarungModal open={detailOpen} title={detailHead ? `Opname ${detailHead.opnameId} (${detailHead.status})` : "Detail"} onClose={() => setDetailOpen(false)} maxWidth="max-w-5xl">
        {detailLoading ? (
          <div className="p-6 text-center text-slate-500 text-xs">Memuat...</div>
        ) : detailHead ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <div className="text-xs text-slate-600">
                Snapshot: {detailHead.snapshotAt ? new Date(detailHead.snapshotAt).toLocaleString("id-ID") : "-"}
              </div>
              <div className="flex gap-2">
                {detailHead.status === "DRAFT" && (
                  <>
                    <button type="button" onClick={() => doAction("REVIEW")} disabled={actionSubmitting} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold">Review</button>
                    <button type="button" onClick={() => { if (confirm("Hapus opname ini?")) doAction("DELETE"); }} disabled={actionSubmitting} className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-xs font-bold">Hapus</button>
                  </>
                )}
                {detailHead.status === "REVIEW" && (
                  <button type="button" onClick={() => { if (confirm("Posting opname? Stok akan disesuaikan.")) doAction("POST"); }} disabled={actionSubmitting} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold">POST</button>
                )}
              </div>
            </div>
            <WarungDataTable columns={itemColumns} data={detailItems} rowKey={(r) => r.itemId} emptyMessage="Tidak ada item." />
          </div>
        ) : (
          <div className="p-4 text-center text-slate-400 text-xs">-</div>
        )}
      </WarungModal>
    </div>
  );
}