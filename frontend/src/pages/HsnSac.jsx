import { useMemo, useState } from "react";
import { api } from "../services/api.js";
import { Modal } from "../components/Modal.jsx";

const blank = { code: "", description: "", gstRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, unit: "No.", notes: "", active: true };

export default function HsnSac({ ctx }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const rows = useMemo(() => ctx.hsn.filter(h => [h.code, h.description].join(" ").toLowerCase().includes(search.toLowerCase())), [ctx.hsn, search]);
  const save = async (form) => {
    editing?.id ? await api.hsn.update(editing.id, form) : await api.hsn.create(form);
    ctx.notify("HSN/SAC saved.");
    setEditing(null);
    await ctx.reload();
  };
  return (
    <section className="view active">
      <div className="section-head"><div><h1>HSN/SAC Master</h1><p>GST rates are copied into invoice lines and can be overridden per invoice.</p></div><button className="primary" onClick={() => setEditing(blank)}>Add HSN/SAC</button></div>
      <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description" />
      <div className="table-wrap panel"><table className="data-table"><thead><tr><th>Code</th><th>Description</th><th>GST</th><th>Unit</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map(h => <tr key={h.id}><td>{h.code}</td><td>{h.description}</td><td>{h.gstRate}%</td><td>{h.unit}</td><td>{h.active ? "Active" : "Inactive"}</td><td><button className="small secondary" onClick={() => setEditing(h)}>Edit</button> <button className="small danger" onClick={async () => { await api.hsn.remove(h.id); await ctx.reload(); }}>Deactivate</button></td></tr>)}
        {!rows.length && <tr><td colSpan="6">No HSN/SAC records.</td></tr>}
      </tbody></table></div>
      <Modal onClose={() => setEditing(null)}>{editing && <HsnSacForm initial={editing} onSave={save} />}</Modal>
    </section>
  );
}

export function HsnSacForm({ initial, onSave }) {
  const [form, setForm] = useState(initial);
  const set = (key, value) => setForm({ ...form, [key]: value });
  return <form className="stack" onSubmit={e => { e.preventDefault(); onSave(form); }}>
    <h2>HSN/SAC</h2>
    <div className="grid two">
      <label>HSN/SAC Code<input required value={form.code || ""} onChange={e => set("code", e.target.value)} /></label>
      <label>Description<input required value={form.description || ""} onChange={e => set("description", e.target.value)} /></label>
      {["gstRate", "cgstRate", "sgstRate", "igstRate"].map(key => <label key={key}>{key}<input type="number" step="0.01" value={form[key] || 0} onChange={e => set(key, e.target.value)} /></label>)}
      <label>Unit<input value={form.unit || ""} onChange={e => set("unit", e.target.value)} /></label>
      <label>Status<select value={String(form.active)} onChange={e => set("active", e.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></select></label>
    </div>
    <label>Notes<textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} /></label>
    <button className="primary">Save HSN/SAC</button>
  </form>;
}
