import { useMemo, useState } from "react";
import { api } from "../services/api.js";
import { Modal } from "../components/Modal.jsx";

const blank = { name: "", billingAddress: "", shippingAddress: "", contactPerson: "", contactNumber: "", email: "", gstin: "", state: "Maharashtra", stateCode: "27", pan: "", customerType: "Business", notes: "", active: true };

export default function Customers({ ctx }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const rows = useMemo(() => ctx.customers.filter(c => [c.name, c.gstin, c.contactNumber, c.email].join(" ").toLowerCase().includes(search.toLowerCase())), [ctx.customers, search]);
  const save = async (form) => {
    editing?.id ? await api.customers.update(editing.id, form) : await api.customers.create(form);
    ctx.notify("Customer saved.");
    setEditing(null);
    await ctx.reload();
  };
  return (
    <section className="view active">
      <div className="section-head"><div><h1>Customer Master</h1><p>Reusable client records for invoice creation.</p></div><button className="primary" onClick={() => setEditing(blank)}>Add Customer</button></div>
      <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by client, GSTIN, contact, email" />
      <div className="table-wrap panel">
        <table className="data-table"><thead><tr><th>Name</th><th>GSTIN</th><th>Contact</th><th>Email</th><th>State</th><th>Status</th><th></th></tr></thead><tbody>
          {rows.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.gstin}</td><td>{c.contactPerson} {c.contactNumber}</td><td>{c.email}</td><td>{c.state}</td><td>{c.active ? "Active" : "Inactive"}</td><td><button className="small secondary" onClick={() => setEditing(c)}>Edit</button> <button className="small danger" onClick={async () => { await api.customers.remove(c.id); await ctx.reload(); }}>Deactivate</button></td></tr>)}
          {!rows.length && <tr><td colSpan="7">No customers.</td></tr>}
        </tbody></table>
      </div>
      <Modal onClose={() => setEditing(null)}>{editing && <CustomerForm initial={editing} onSave={save} />}</Modal>
    </section>
  );
}

export function CustomerForm({ initial, onSave }) {
  const [form, setForm] = useState(initial);
  const set = (key, value) => setForm({ ...form, [key]: value });
  return <form className="stack" onSubmit={e => { e.preventDefault(); onSave(form); }}>
    <h2>Customer</h2>
    <div className="grid two">
      {field("Client/Company Name", "name", form, set, true)}
      {field("Customer Type", "customerType", form, set)}
      {area("Billing Address", "billingAddress", form, set, true)}
      {area("Shipping Address", "shippingAddress", form, set)}
      {field("Contact Person", "contactPerson", form, set)}
      {field("Contact Number", "contactNumber", form, set)}
      {field("Email ID", "email", form, set, false, "email")}
      {field("GSTIN", "gstin", form, set)}
      {field("State", "state", form, set)}
      {field("State Code", "stateCode", form, set)}
      {field("PAN", "pan", form, set)}
      <label>Status<select value={String(form.active)} onChange={e => set("active", e.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></select></label>
    </div>
    {area("Notes", "notes", form, set)}
    <button className="primary">Save Customer</button>
  </form>;
}

function field(label, key, form, set, required = false, type = "text") { return <label>{label}<input type={type} required={required} value={form[key] || ""} onChange={e => set(key, e.target.value)} /></label>; }
function area(label, key, form, set, required = false) { return <label>{label}<textarea required={required} value={form[key] || ""} onChange={e => set(key, e.target.value)} /></label>; }
