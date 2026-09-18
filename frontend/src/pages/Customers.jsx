import { useMemo, useState } from "react";
import { api } from "../services/api.js";
import { inr } from "../utils/money.js";

const blank = { name: "", legalName: "", billingAddress: "", shippingAddress: "", contactPerson: "", designation: "", contactNumber: "", alternatePhone: "", email: "", gstin: "", state: "Maharashtra", stateCode: "27", country: "India", pinCode: "", pan: "", customerType: "Sales Customer Account", notes: "", active: true, contacts: [] };

export default function Customers({ ctx }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [editing, setEditing] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("list");
  const rows = useMemo(() => ctx.customers
    .filter(c => [c.name, c.legalName, c.gstin, c.contactPerson, c.contactNumber, c.email, c.customerType].join(" ").toLowerCase().includes(search.toLowerCase()))
    .filter(c => status === "all" || (status === "active" ? c.active : !c.active))
    .filter(c => type === "all" || c.customerType === type), [ctx.customers, search, status, type]);
  const save = async (form) => {
    editing?.id ? await api.customers.update(editing.id, form) : await api.customers.create(form);
    ctx.notify("Customer saved.");
    setEditing(null);
    setView("list");
    await ctx.reload();
  };
  const openProfile = async (customer) => {
    try {
      setProfile(await api.customers.get(customer.id));
      setEditing(null);
      setView("profile");
    } catch (err) { ctx.notify(err.message, "err"); }
  };
  const openForm = (customer = blank) => {
    setEditing(customer);
    setProfile(null);
    setView("form");
  };
  const closeSubpage = () => {
    setEditing(null);
    setProfile(null);
    setView("list");
  };
  const deletePermanent = async (customer) => {
    const confirmed = confirm(`Permanently delete ${customer.name} from the database?\n\nThis removes the customer record and saved contacts. Existing invoices and quotations will remain as historical records.`);
    if (!confirmed) return;
    try {
      await api.customers.deletePermanent(customer.id);
      ctx.notify("Customer permanently deleted.");
      if (profile?.id === customer.id) closeSubpage();
      await ctx.reload();
    } catch (err) {
      ctx.notify(err.message, "err");
    }
  };
  if (view === "form" && editing) {
    return <section className="view active">
      <div className="section-head">
        <div><h1>{editing.id ? "Edit Customer" : "Add Customer"}</h1><p>Maintain company profile, GST details, billing addresses, and CRM contacts.</p></div>
        <button className="secondary" onClick={closeSubpage}>Back to Customers</button>
      </div>
      <CustomerForm initial={editing} onSave={save} onCancel={closeSubpage} />
    </section>;
  }
  if (view === "profile" && profile) {
    return <section className="view active">
      <div className="section-head">
        <div><h1>{profile.name}</h1><p>Customer account profile, contact data, and business history.</p></div>
        <div className="actions">
          <button className="secondary" onClick={closeSubpage}>Back to Customers</button>
          <button className="primary" onClick={() => openForm(profile)}>Edit Customer</button>
          <button className="danger" onClick={() => deletePermanent(profile)}>Delete Customer</button>
        </div>
      </div>
      <CustomerProfile customer={profile} />
    </section>;
  }
  return (
    <section className="view active">
      <div className="section-head">
        <div><h1>Customers</h1><p>CRM-style customer accounts, contacts, GST information, and business history.</p></div>
        <button className="primary" onClick={() => openForm(blank)}>Add Customer</button>
      </div>
      <div className="filters">
        <input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company, GSTIN, contact, status, type" />
        {["all", "active", "inactive"].map(id => <button key={id} className={status === id ? "active" : ""} onClick={() => setStatus(id)}>{id}</button>)}
        {["all", "Sales Customer Account", "Support Customer Account"].map(id => <button key={id} className={type === id ? "active" : ""} onClick={() => setType(id)}>{id === "all" ? "All Types" : id}</button>)}
      </div>
      <div className="table-wrap panel customer-list-table">
        <table className="data-table"><thead><tr><th>Account</th><th>Primary Contact</th><th>GSTIN / PAN</th><th>Phone</th><th>Email</th><th>Account Type</th><th>Status</th><th>Created Date</th><th>Actions</th></tr></thead><tbody>
          {rows.map(c => <tr key={c.id}>
            <td><div className="account-cell"><strong>{c.name}</strong><small>{c.legalName && c.legalName !== c.name ? c.legalName : [c.state, c.country].filter(Boolean).join(", ") || "Customer account"}</small></div></td>
            <td><div className="account-cell compact"><strong>{c.contactPerson || "-"}</strong><small>{c.designation || "Primary contact"}</small></div></td>
            <td><div className="account-cell compact"><strong>{c.gstin || "-"}</strong><small>{c.pan || "PAN not added"}</small></div></td>
            <td>{c.contactNumber || "-"}</td>
            <td>{c.email || "-"}</td>
            <td><span className="badge">{c.customerType}</span></td>
            <td><span className={`badge ${c.active ? "paid" : "cancel"}`}>{c.active ? "Active" : "Inactive"}</span></td>
            <td>{formatDate(c.createdAt)}</td>
            <td><div className="record-actions"><button className="small secondary" onClick={() => openProfile(c)}>View</button><button className="small secondary" onClick={() => openForm(c)}>Edit</button>{c.active && <button className="small danger" onClick={async () => { if (confirm(`Deactivate ${c.name}?`)) { await api.customers.remove(c.id); await ctx.reload(); } }}>Deactivate</button>}<button className="small danger" onClick={() => deletePermanent(c)}>Delete</button></div></td>
          </tr>)}
          {!rows.length && <tr><td colSpan="9">No customers.</td></tr>}
        </tbody></table>
      </div>
    </section>
  );
}

export function CustomerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...blank, ...initial, contacts: initial.contacts?.length ? initial.contacts : [{ name: initial.contactPerson || "", designation: initial.designation || "", email: initial.email || "", phone: initial.contactNumber || "", isPrimary: true }] });
  const set = (key, value) => setForm({ ...form, [key]: value });
  const setContact = (index, next) => set("contacts", form.contacts.map((contact, i) => i === index ? { ...contact, ...next } : contact));
  return <form className="stack crm-form customer-form" onSubmit={e => { e.preventDefault(); onSave(form); }}>
    <div className="form-page-head"><h2>{form.id ? "Customer Details" : "New Customer Details"}</h2><p className="hint">Fields are grouped like a CRM account record. Required fields stay the same as before.</p></div>
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
    <div className="panel">{area("Notes", "notes", form, set)}</div>
    <div className="form-actions sticky-actions">
      <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      <button className="primary">Save Customer</button>
    </div>
  </form>;
}

function CustomerProfile({ customer }) {
  const [tab, setTab] = useState("details");
  const h = customer.history || {};
  const contacts = customer.contacts || [];
  return <div className="stack customer-profile account-record">
    <div className="panel account-record-header">
      <div className="account-record-title">
        <div className="account-avatar">{initials(customer.name)}</div>
        <div>
          <span className="eyebrow">Customer Account</span>
          <h2>{customer.name}</h2>
          <p>{customer.legalName || customer.customerType || "Account profile"}</p>
        </div>
      </div>
      <div className="account-record-badges">
        <span className="badge">{customer.customerType}</span>
        <span className={`badge ${customer.active ? "paid" : "cancel"}`}>{customer.active ? "Active" : "Inactive"}</span>
      </div>
      <div className="account-key-fields">
        {infoTile("GSTIN", customer.gstin)}
        {infoTile("Primary Contact", customer.contactPerson)}
        {infoTile("Email", customer.email)}
        {infoTile("Phone", customer.contactNumber)}
      </div>
    </div>

    <div className="account-tabs" role="tablist" aria-label="Customer account sections">
      {["details", "contacts", "business"].map(id => <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{id === "details" ? "Details" : id === "contacts" ? `Contacts (${contacts.length})` : "Business Summary"}</button>)}
    </div>

    {tab === "details" && <div className="account-detail-grid">
      <div className="panel account-section">
        <h2>Account Information</h2>
        <div className="account-field-grid">
          {infoRow("Customer Name", customer.name)}
          {infoRow("Legal Name", customer.legalName || customer.name)}
          {infoRow("Customer Type", customer.customerType)}
          {infoRow("Status", customer.active ? "Active" : "Inactive")}
          {infoRow("GSTIN", customer.gstin)}
          {infoRow("PAN", customer.pan)}
          {infoRow("State", customer.state)}
          {infoRow("State Code", customer.stateCode)}
          {infoRow("Country", customer.country)}
          {infoRow("PIN Code", customer.pinCode)}
        </div>
      </div>
      <div className="panel account-section">
        <h2>Primary Contact</h2>
        <div className="account-field-grid single">
          {infoRow("Contact Person", customer.contactPerson)}
          {infoRow("Designation", customer.designation)}
          {infoRow("Email", customer.email)}
          {infoRow("Phone", customer.contactNumber)}
          {infoRow("Alternate Phone", customer.alternatePhone)}
        </div>
      </div>
      <div className="panel account-section wide">
        <h2>Address Information</h2>
        <div className="account-field-grid">
          {infoRow("Billing Address", customer.billingAddress, true)}
          {infoRow("Shipping Address", customer.shippingAddress, true)}
          {infoRow("Notes", customer.notes, true)}
        </div>
      </div>
    </div>}

    {tab === "contacts" && <div className="panel related-panel">
      <div className="related-head"><h2>Related Contacts</h2><span>{contacts.length} contact{contacts.length === 1 ? "" : "s"}</span></div>
      <div className="table-wrap">
        <table className="data-table account-contact-table"><thead><tr><th>Name</th><th>Designation</th><th>Email</th><th>Phone</th><th>Type</th></tr></thead><tbody>
          {contacts.map(contact => <tr key={contact.id || `${contact.name}-${contact.email}`}>
            <td><strong>{contact.name || "-"}</strong></td>
            <td>{contact.designation || "-"}</td>
            <td>{contact.email || "-"}</td>
            <td>{contact.phone || "-"}</td>
            <td>{contact.isPrimary ? <span className="badge paid">Primary</span> : <span className="badge">Additional</span>}</td>
          </tr>)}
          {!contacts.length && <tr><td colSpan="5">No contacts added.</td></tr>}
        </tbody></table>
      </div>
    </div>}

    {tab === "business" && <div className="business-summary">
      <div className="metric-grid account-metrics">
        <div className="metric"><span>Total Invoices</span><strong>{h.total_invoices || 0}</strong></div>
        <div className="metric"><span>Paid Amount</span><strong>{inr(h.paid_cents || 0)}</strong></div>
        <div className="metric"><span>Outstanding</span><strong>{inr(h.outstanding_cents || 0)}</strong></div>
        <div className="metric"><span>Quotations</span><strong>{h.total_quotations || 0}</strong></div>
        <div className="metric"><span>Accepted Quotes</span><strong>{h.accepted_quotations || 0}</strong></div>
      </div>
      <div className="panel account-section">
        <h2>Business Snapshot</h2>
        <div className="account-field-grid">
          {infoRow("Invoice Count", h.total_invoices || 0)}
          {infoRow("Quotation Count", h.total_quotations || 0)}
          {infoRow("Accepted Quotations", h.accepted_quotations || 0)}
          {infoRow("Outstanding Amount", inr(h.outstanding_cents || 0))}
        </div>
      </div>
    </div>}
  </div>;
}

function field(label, key, form, set, required = false, type = "text") { return <label>{label}<input type={type} required={required} value={form[key] || ""} onChange={e => set(key, e.target.value)} /></label>; }
function area(label, key, form, set, required = false) { return <label>{label}<textarea required={required} value={form[key] || ""} onChange={e => set(key, e.target.value)} /></label>; }
function initials(value = "") { return value.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "C"; }
function displayValue(value) { return value === 0 || value ? value : "-"; }
function infoTile(label, value) { return <div className="account-info-tile"><span>{label}</span><strong>{displayValue(value)}</strong></div>; }
function infoRow(label, value, multiline = false) { return <div className={`account-field ${multiline ? "multiline" : ""}`}><span>{label}</span><strong>{displayValue(value)}</strong></div>; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("en-IN") : "-"; }
