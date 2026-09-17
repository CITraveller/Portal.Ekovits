import { useMemo, useState } from "react";
import { api } from "../services/api.js";

const blank = { code: "", description: "", gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, unit: "No.", notes: "", active: true };

export default function HsnSac({ ctx }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState("list");
  const rows = useMemo(() => ctx.hsn.filter(h => [h.code, h.description].join(" ").toLowerCase().includes(search.toLowerCase())), [ctx.hsn, search]);
  const save = async (form) => {
    editing?.id ? await api.hsn.update(editing.id, form) : await api.hsn.create(form);
    ctx.notify("HSN/SAC saved.");
    setEditing(null);
    setView("list");
    await ctx.reload();
  };
  const openForm = (record = blank) => {
    setEditing(record);
    setView("form");
  };
  const closeForm = () => {
    setEditing(null);
    setView("list");
  };
  if (view === "form" && editing) {
    return <section className="view active">
      <div className="section-head">
        <div><h1>{editing.id ? "Edit HSN/SAC" : "Add HSN/SAC"}</h1><p>Maintain GST classification, rate split, unit, status, and notes for invoice line items.</p></div>
        <button className="secondary" onClick={closeForm}>Back to HSN/SAC Master</button>
      </div>
      <HsnSacForm initial={editing} onSave={save} onCancel={closeForm} />
    </section>;
  }
  return (
    <section className="view active">
      <div className="section-head"><div><h1>HSN/SAC Master</h1><p>GST rates are copied into invoice lines and can be overridden per invoice.</p></div><button className="primary" onClick={() => openForm(blank)}>Add HSN/SAC</button></div>
      <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description" />
      <div className="table-wrap panel"><table className="data-table"><thead><tr><th>Code</th><th>Description</th><th>GST</th><th>Unit</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map(h => <tr key={h.id}><td><strong>{h.code}</strong></td><td>{h.description}</td><td>{h.gstRate}%</td><td>{h.unit}</td><td><span className={`badge ${h.active ? "paid" : "cancel"}`}>{h.active ? "Active" : "Inactive"}</span></td><td><div className="record-actions"><button className="small secondary" onClick={() => openForm(h)}>Edit</button><button className="small danger" onClick={async () => { await api.hsn.remove(h.id); await ctx.reload(); }}>Deactivate</button></div></td></tr>)}
        {!rows.length && <tr><td colSpan="6">No HSN/SAC records.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

export function HsnSacForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (key, value) => setForm({ ...form, [key]: value });
  return <form className="stack master-form" onSubmit={e => { e.preventDefault(); onSave(form); }}>
    <div className="form-page-head"><h2>Classification Details</h2><p className="hint">Use this record to standardize invoice line-item tax defaults.</p></div>
    <div className="panel"><h2>HSN/SAC Information</h2><div className="grid two">
      <label>HSN/SAC Code<input required value={form.code || ""} onChange={e => set("code", e.target.value)} /></label>
      <label>Description<input required value={form.description || ""} onChange={e => set("description", e.target.value)} /></label>
      <label>Unit<input value={form.unit || ""} onChange={e => set("unit", e.target.value)} /></label>
      <label>Status<select value={String(form.active)} onChange={e => set("active", e.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></select></label>
    </div></div>
    <div className="panel"><h2>GST Rate Split</h2><div className="grid four">
      {["gstRate", "cgstRate", "sgstRate", "igstRate"].map(key => <label key={key}>{labelRate(key)}<input type="number" step="0.01" value={form[key] || 0} onChange={e => set(key, e.target.value)} /></label>)}
    </div>
    </div>
    <div className="panel"><label>Notes<textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} /></label></div>
    <div className="form-actions sticky-actions">
      <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      <button className="primary">Save HSN/SAC</button>
    </div>
  </form>;
}

function labelRate(key) {
  return ({ gstRate: "GST Rate %", cgstRate: "CGST Rate %", sgstRate: "SGST Rate %", igstRate: "IGST Rate %" })[key] || key;
}
