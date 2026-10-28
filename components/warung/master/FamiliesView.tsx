"use client";

import React, { useEffect, useState } from "react";
import WarungDataTable, { type Column } from "@/components/warung/shared/WarungDataTable";
import WarungModal from "@/components/warung/shared/WarungModal";
import WarungSearchInput from "@/components/warung/shared/WarungSearchInput";

interface Family {
  famCode: string;
  divCode: string;
  deptCode: string;
  familyCodeLocal: string;
  familyName: string;
  active: boolean;
}

interface Division { divCode: string; divName: string; active: boolean; }
interface Department { deptId: string; divCode: string; deptCode: string; deptName: string; }

export default function FamiliesView() {
  const [items, setItems] = useState<Family[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filterDiv, setFilterDiv] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Family | null>(null);
  const [form, setForm] = useState({ divCode: "", deptCode: "", familyCodeLocal: "", familyName: "", active: true });
  const [submitting, setSubmitting] = useState(false);

  async function loadRefs() {
    try {
      const [dRes, pRes] = await Promise.all([
        fetch("/api/warung/divisions?active=true"),
        fetch("/api/warung/departments"),
      ]);
      const dJ = await dRes.json();
      const pJ = await pRes.json();
      if (dJ.success) setDivisions(dJ.data);
      if (pJ.success) setDepartments(pJ.data);
    } catch {}
  }

  async function loadFamilies() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (filterDiv) params.set("divCode", filterDiv);
      const res = await fetch("/api/warung/families?" + params.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.success) setItems(j.data);
      else setMsg({ type: "error", text: j.message });
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRefs(); loadFamilies(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function openCreate() {
    setEditing(null);
    setForm({ divCode: divisions[0]?.divCode || "", deptCode: "", familyCodeLocal: "", familyName: "", active: true });
    setModalOpen(true);
  }

  function openEdit(f: Family) {
    setEditing(f);
    setForm({ divCode: f.divCode, deptCode: f.deptCode, familyCodeLocal: f.familyCodeLocal, familyName: f.familyName, active: f.active });
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const isNew = !editing;
      const url = isNew ? "/api/warung/families" : `/api/warung/families/${encodeURIComponent(editing.famCode)}`;
      const body: any = { familyName: form.familyName, active: form.active };
      if (isNew) { body.divCode = form.divCode; body.deptCode = form.deptCode; body.familyCodeLocal = form.familyCodeLocal; }
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message || "Berhasil." });
      setModalOpen(false);
      await loadFamilies();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
    finally { setSubmitting(false); }
  }

  async function remove(f: Family) {
    if (!confirm(`Hapus family ${f.famCode} - ${f.familyName}?`)) return;
    try {
      const res = await fetch(`/api/warung/families/${encodeURIComponent(f.famCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.success) { setMsg({ type: "error", text: j.message }); return; }
      setMsg({ type: "success", text: j.message || "Dihapus." });
      await loadFamilies();
    } catch (e: any) { setMsg({ type: "error", text: e.message }); }
  }

  const eligibleDepts = departments.filter((d) => !form.divCode || d.divCode === form.divCode);

  const columns: Column<Family>[] = [
    { key: "famCode", label: "FAM Code", render: (r) => <span className="font-mono font-bold text-slate-900">{r.famCode}</span> },
    { key: "divCode", label: "Div", render: (r) => <span className="font-mono">{r.divCode}</span> },
    { key: "deptCode", label: "Dept", render: (r) => <span className="font-mono">{r.deptCode}</span> },
    { key: "familyCodeLocal", label: "Fam", render: (r) => <span className="font-mono">{r.familyCodeLocal}</span> },
    { key: "familyName", label: "Nama Family" },
    { key: "active", label: "Status", render: (r) => r.active ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">AKTIF</span> : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">NONAKTIF</span> },
    { key: "actions", label: "Aksi", render: (r) => (
      <div className="space-x-1 whitespace-nowrap">
        <button type="button" onClick={() => openEdit(r)} className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-bold">Edit</button>
        <button type="button" onClick={() => remove(r)} className="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold">Hapus</button>
      </div>
    )},
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <span className="text-xs font-bold text-slate-900 uppercase">Master Family</span>
          <p className="text-[11px] text-slate-500">FAM Code = Div + Dept + Fam (3 digit)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filterDiv} onChange={(e) => setFilterDiv(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs">
            <option value="">Semua Divisi</option>
            {divisions.map((d) => <option key={d.divCode} value={d.divCode}>{d.divCode} - {d.divName}</option>)}
          </select>
          <WarungSearchInput value={q} onChange={setQ} />
          <button type="button" onClick={loadFamilies} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cari</button>
          <button type="button" onClick={openCreate} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold whitespace-nowrap">+ Tambah</button>
        </div>
      </div>

      {msg && <div className={`p-2 rounded text-xs font-medium ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>{msg.text}</div>}

      <WarungDataTable columns={columns} data={items} loading={loading} rowKey={(r) => r.famCode} emptyMessage="Belum ada family." />

      <WarungModal open={modalOpen} title={editing ? `Edit Family ${editing.famCode}` : "Tambah Family"} onClose={() => setModalOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          {!editing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Divisi</label>
                <select required value={form.divCode} onChange={(e) => setForm({ ...form, divCode: e.target.value, deptCode: "" })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">-- pilih --</option>
                  {divisions.map((d) => <option key={d.divCode} value={d.divCode}>{d.divCode} - {d.divName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departemen</label>
                <select required value={form.deptCode} onChange={(e) => setForm({ ...form, deptCode: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">-- pilih --</option>
                  {eligibleDepts.map((d) => <option key={d.deptId} value={d.deptCode}>{d.deptId} - {d.deptName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Family Lokal (1 digit 0-9)</label>
                <input type="text" required minLength={1} maxLength={1} value={form.familyCodeLocal} onChange={(e) => setForm({ ...form, familyCodeLocal: e.target.value.replace(/\D/g, "") })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" />
                <p className="text-[10px] text-slate-500 mt-1">Preview FAM Code: <span className="font-mono font-bold">{form.divCode || "?"}{form.deptCode || "?"}{form.familyCodeLocal || "?"}</span></p>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Family</label>
            <input type="text" required value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {editing && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="fam-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
              <label htmlFor="fam-active" className="text-xs font-semibold text-slate-700">Aktif</label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={submitting} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">Batal</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg">{submitting ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </WarungModal>
    </div>
  );
}