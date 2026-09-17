import { useMemo, useState } from "react";
import { api } from "../services/api.js";
import { Modal } from "../components/Modal.jsx";
import { inr } from "../utils/money.js";

const blank = { name: "", legalName: "", billingAddress: "", shippingAddress: "", contactPerson: "", designation: "", contactNumber: "", alternatePhone: "", email: "", gstin: "", state: "Maharashtra", stateCode: "27", country: "India", pinCode: "", pan: "", customerType: "Sales Customer Account", notes: "", active: true, contacts: [] };

export default function Customers({ ctx }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [editing, setEditing] = useState(null);
  const [profile, setProfile] = useState(null);
  const rows = useMemo(() => ctx.customers
    .filter(c => [c.name, c.legalName, c.gstin, c.contactPerson, c.contactNumber, c.email, c.customerType].join(" ").toLowerCase().includes(search.toLowerCase()))
    .filter(c => status === "all" || (status === "active" ? c.active : !c.active))
    .filter(c => type === "all" || c.customerType === type), [ctx.customers, search, status, type]);
  const save = async (form) => {
    editing?.id ? await api.customers.update(editing.id, form) : await api.customers.create(form);
    ctx.notify("Customer saved.");
    setEditing(null);
    await ctx.reload();
  };
  const openProfile = async (customer) => {
    try { setProfile(await api.customers.get(customer.id)); } catch (err) { ctx.notify(err.message, "err"); }
  };
  return (
    <section className="view active">
      <div className="section-head">
        <div><h1>Customers</h1><p>CRM-style customer accounts, contacts, GST information, and business history.</p></div>
        <button className="primary" onClick={() => setEditing(blank)}>Add Customer</button>
      </div>
      <div className="filters">
        <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, GSTIN, contact, status, type" />
        {["all", "active", "inactive"].map(id => <button key={id} className={status === id ? "active" : ""} onClick={() => setStatus(id)}>{id}</button>)}
        {["all", "Sales Customer Account", "Support Customer Account"].map(id => <button key={id} className={type === id ? "active" : ""} onClick={() => setType(id)}>{id === "all" ? "All Types" : id}</button>)}
      </div>
      <div className="table-wrap panel">
        <table className="data-table"><thead><tr><th>Customer Name</th><th>Company Name</th><th>GSTIN</th><th>Primary Contact</th><th>Email</th><th>Phone</th><th>Customer Type</th><th>Status</th><th>Created Date</th><th>Actions</th></tr></thead><tbody>
          {rows.map(c => <tr key={c.id}>
            <td><strong>{c.name}</strong></td>
            <td>{c.legalName || c.name}</td>
            <td>{c.gstin || "-"}</td>
            <td>{c.contactPerson || "-"}</td>
            <td>{c.email || "-"}</td>
            <td>{c.contactNumber || "-"}</td>
            <td><span className="badge">{c.customerType}</span></td>
            <td><span className={`badge ${c.active ? "paid" : "cancel"}`}>{c.active ? "Active" : "Inactive"}</span></td>
            <td>{formatDate(c.createdAt)}</td>
            <td><div className="record-actions"><button className="small secondary" onClick={() => openProfile(c)}>View</button><button className="small secondary" onClick={() => setEditing(c)}>Edit</button>{c.active && <button className="small danger" onClick={async () => { if (confirm(`Deactivate ${c.name}?`)) { await api.customers.remove(c.id); await ctx.reload(); } }}>Deactivate</button>}</div></td>
          </tr>)}
          {!rows.length && <tr><td colSpan="10">No customers.</td></tr>}
        </tbody></table>
      </div>
      <Modal onClose={() => setEditing(null)}>{editing && <CustomerForm initial={editing} onSave={save} />}</Modal>
      <Modal onClose={() => setProfile(null)}>{profile && <CustomerProfile customer={profile} />}</Modal>
    </section>
  );
}

export function CustomerForm({ initial, onSave }) {
  const [form, setForm] = useState({ ...blank, ...initial, contacts: initial.contacts?.length ? initial.contacts : [{ name: initial.contactPerson || "", designation: initial.designation || "", email: initial.email || "", phone: initial.contactNumber || "", isPrimary: true }] });
  const set = (key, value) => setForm({ ...form, [key]: value });
  const setContact = (index, next) => set("contacts", form.contacts.map((contact, i) => i === index ? { ...contact, ...next } : contact));
  return <form className="stack crm-form" onSubmit={e => { e.preventDefault(); onSave(form); }}>
    <h2>{form.id ? "Edit Customer" : "Add Customer"}</h2>
    <div className="panel"><h2>Company Information</h2><div className="grid four">
      {field("Company / Customer Name", "name", form, set, true)}
      {field("Legal Name", "legalName", form, set)}
      {field("GSTIN", "gstin", form, set)}
      {field("PAN", "pan", form, set)}
      <label>Customer Type<select value={form.customerType} onChange={e => set("customerType", e.target.value)}><option>Sales Customer Account</option><option>Support Customer Account</option></select></label>
      <label>Status<select value={String(form.active)} onChange={e => set("active", e.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></select></label>
      {field("State", "state", form, set)}
      {field("State Code", "stateCode", form, set)}
      {field("Country", "country", form, set)}
      {field("PIN Code", "pinCode", form, set)}
      {area("Billing Address", "billingAddress", form, set, true)}
      {area("Shipping Address", "shippingAddress", form, set)}
    </div></div>
    <div className="panel"><h2>Primary Contact</h2><div className="grid four">
      {field("Contact Person Name", "contactPerson", form, set)}
      {field("Designation", "designation", form, set)}
      {field("Email", "email", form, set, false, "email")}
      {field("Phone", "contactNumber", form, set)}
      {field("Alternate Phone", "alternatePhone", form, set)}
    </div></div>
    <div className="panel"><div className="inline-title"><h2>Additional Contacts</h2><button type="button" className="primary small" onClick={() => set("contacts", [...form.contacts, { name: "", designation: "", email: "", phone: "", isPrimary: false }])}>Add Contact</button></div>
      <div className="contact-list">{form.contacts.map((contact, index) => <div className="contact-row" key={index}>
        <input placeholder="Name" value={contact.name || ""} onChange={e => setContact(index, { name: e.target.value })} />
        <input placeholder="Designation" value={contact.designation || ""} onChange={e => setContact(index, { designation: e.target.value })} />
        <input placeholder="Email" value={contact.email || ""} onChange={e => setContact(index, { email: e.target.value })} />
        <input placeholder="Phone" value={contact.phone || ""} onChange={e => setContact(index, { phone: e.target.value })} />
        <label className="checkline"><input type="checkbox" checked={contact.isPrimary === true} onChange={e => setContact(index, { isPrimary: e.target.checked })} /> Primary</label>
        <button type="button" className="danger small" onClick={() => set("contacts", form.contacts.filter((_, i) => i !== index))}>Remove</button>
      </div>)}</div>
    </div>
    {area("Notes", "notes", form, set)}
    <button className="primary">Save Customer</button>
  </form>;
}

function CustomerProfile({ customer }) {
  const h = customer.history || {};
  return <div className="stack customer-profile">
    <div><h2>{customer.name}</h2><p className="hint">{customer.customerType} · {customer.active ? "Active" : "Inactive"}</p></div>
    <div className="metric-grid">
      <div className="metric"><span>Total Invoices</span><strong>{h.total_invoices || 0}</strong></div>
      <div className="metric"><span>Paid Amount</span><strong>{inr(h.paid_cents || 0)}</strong></div>
      <div className="metric"><span>Outstanding</span><strong>{inr(h.outstanding_cents || 0)}</strong></div>
      <div className="metric"><span>Quotations</span><strong>{h.total_quotations || 0}</strong></div>
      <div className="metric"><span>Accepted Quotes</span><strong>{h.accepted_quotations || 0}</strong></div>
    </div>
    <div className="grid two">
      <div className="panel"><h2>Overview</h2><p><strong>Legal Name:</strong> {customer.legalName || customer.name}</p><p><strong>GSTIN:</strong> {customer.gstin || "-"}</p><p><strong>PAN:</strong> {customer.pan || "-"}</p><p><strong>Billing:</strong><br />{customer.billingAddress}</p><p><strong>Shipping:</strong><br />{customer.shippingAddress || "-"}</p></div>
      <div className="panel"><h2>Contacts</h2>{(customer.contacts || []).map(contact => <p key={contact.id || contact.name}><strong>{contact.name}</strong> {contact.isPrimary && <span className="badge paid">Primary</span>}<br />{contact.designation || "-"}<br />{contact.email || "-"} · {contact.phone || "-"}</p>)}</div>
    </div>
  </div>;
}

function field(label, key, form, set, required = false, type = "text") { return <label>{label}<input type={type} required={required} value={form[key] || ""} onChange={e => set(key, e.target.value)} /></label>; }
function area(label, key, form, set, required = false) { return <label>{label}<textarea required={required} value={form[key] || ""} onChange={e => set(key, e.target.value)} /></label>; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("en-IN") : "-"; }
