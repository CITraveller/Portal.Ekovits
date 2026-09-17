import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api.js";
import { calculateTotals, resolvedGstType } from "../utils/calculations.js";
import { amountInWords, inr } from "../utils/money.js";
import { Modal } from "../components/Modal.jsx";
import { QuotationPreview, printQuotation } from "../components/QuotationPreview.jsx";
import { InvoiceItems } from "./InvoiceForm.jsx";

const emptyItem = () => ({ description: "", hsn: "", gstRate: 18, qty: 1, rate: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export default function Quotations({ ctx, editingQuotation, initialFilter = "all" }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(makeBlank(ctx.settings));
  const [preview, setPreview] = useState(null);
  const [numberLoading, setNumberLoading] = useState(false);
  const reservedRef = useRef(false);
  const isEditing = Boolean(editingQuotation?.id && !editingQuotation?.duplicateSourceId);
  const rows = useMemo(() => (ctx.quotations || [])
    .filter(q => [q.quotationNo, q.clientName, q.clientGstin, q.quotationStatus, q.totals?.grandTotalCents / 100].join(" ").toLowerCase().includes(search.toLowerCase()))
    .filter(q => filter === "all" || q.quotationStatus === filter), [ctx.quotations, search, filter]);

  useEffect(() => {
    if (editingQuotation) {
      reservedRef.current = false;
      setShowForm(true);
      setForm(editingQuotation.duplicateSourceId === "new" ? makeBlank(ctx.settings) : editingQuotation.duplicateSourceId ? { ...fromQuotation(editingQuotation), quotationNo: "", quotationStatus: "Draft" } : fromQuotation(editingQuotation));
      if (editingQuotation.duplicateSourceId) reserveNumber();
      return;
    }
    if (!reservedRef.current) {
      reservedRef.current = true;
      setForm(makeBlank(ctx.settings));
      reserveNumber();
    }
  }, [editingQuotation, ctx.settings]);
  useEffect(() => { setFilter(initialFilter || "all"); }, [initialFilter]);

  const gstType = resolvedGstType(ctx.settings.state, form.clientState, form.gstType);
  const totals = useMemo(() => calculateTotals(form.items, gstType), [form.items, gstType]);
  const set = (key, value) => setForm({ ...form, [key]: value });
  const updateItem = (index, next) => set("items", form.items.map((item, i) => i === index ? { ...item, ...next } : item));
  const selectCustomer = (id) => {
    const c = ctx.customers.find(customer => customer.id === id);
    if (!c) return set("customerId", "");
    setForm({ ...form, customerId: id, clientName: c.name, clientAddress: c.billingAddress, clientContact: c.contactNumber, clientEmail: c.email, clientGstin: c.gstin, clientState: c.state, clientStateCode: c.stateCode });
  };
  async function reserveNumber() {
    setNumberLoading(true);
    try {
      const result = await api.quotations.reserveNumber();
      setForm(current => ({ ...current, quotationNo: result.quotationNo }));
    } catch (err) {
      ctx.notify(`Quotation number could not be generated: ${err.message}`, "err");
    } finally {
      setNumberLoading(false);
    }
  }
  const submit = async (status) => {
    try {
      const payload = { ...form, gstType, quotationStatus: status };
      if (!isEditing) delete payload.quotationNo;
      isEditing ? await api.quotations.update(editingQuotation.id, payload) : await api.quotations.create(payload);
      ctx.notify(status === "Draft" ? "Draft quotation saved." : "Quotation saved.");
      ctx.clearEditingQuotation();
      await ctx.reload();
      reservedRef.current = false;
      setForm(makeBlank(ctx.settings));
      setShowForm(false);
    } catch (err) {
      ctx.notify(err.message, "err");
    }
  };
  const openPreview = () => setPreview(buildPreviewQuotation(form, ctx.settings, gstType, totals));

  return <section className="view active">
    <div className="section-head"><div><h1>{showForm ? (isEditing ? `Edit Quotation ${editingQuotation.quotationNo}` : editingQuotation?.duplicateSourceId ? "Create New Quotation" : "Create New Quotation") : "Quotations"}</h1><p>Create, view, print, duplicate, cancel, and manage EKOVITS quotations.</p></div><div className="actions"><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotation, client, GSTIN, status" /><button className="primary" onClick={() => { ctx.clearEditingQuotation(); setForm(makeBlank(ctx.settings)); setShowForm(true); reserveNumber(); }}>Generate New Quote</button></div></div>
    <div className="filters">{["all", "Draft", "Sent", "Accepted", "Rejected", "Expired", "Cancelled"].map(id => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{id}</button>)}</div>
    {showForm && <form className="stack" onSubmit={e => { e.preventDefault(); submit("Sent"); }}>
      <div className="panel"><h2>Quotation Details</h2><div className="grid four">
        <label>Quotation Number<input readOnly value={form.quotationNo || (numberLoading ? "Generating..." : "")} /></label>
        <label>Quotation Date<input type="date" required value={form.quotationDate} onChange={e => set("quotationDate", e.target.value)} /></label>
        <label>Valid Until<input type="date" value={form.validUntil || ""} onChange={e => set("validUntil", e.target.value)} /></label>
        <label>Status<select value={form.quotationStatus} onChange={e => set("quotationStatus", e.target.value)}>{["Draft", "Sent", "Accepted", "Rejected", "Expired", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>GST Treatment<select value={form.gstType} onChange={e => set("gstType", e.target.value)}><option value="auto">Auto from states</option><option value="intra">CGST + SGST</option><option value="inter">IGST</option></select></label>
        <label>Reference<input value={form.referenceNo} onChange={e => set("referenceNo", e.target.value)} /></label>
        <label>Subject<input value={form.subject} onChange={e => set("subject", e.target.value)} /></label>
      </div></div>
      <div className="panel"><h2>Customer</h2><div className="grid two">
        <label>Select Existing Client<select value={form.customerId || ""} onChange={e => selectCustomer(e.target.value)}><option value="">Select customer</option>{ctx.customers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Customer Name<input required value={form.clientName} onChange={e => set("clientName", e.target.value)} /></label>
        <label>Address<textarea required value={form.clientAddress} onChange={e => set("clientAddress", e.target.value)} /></label>
        <label>Phone<input value={form.clientContact} onChange={e => set("clientContact", e.target.value)} /></label>
        <label>Email<input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} /></label>
        <label>GSTIN<input maxLength="15" value={form.clientGstin} onChange={e => set("clientGstin", e.target.value.toUpperCase())} /></label>
        <label>State<input value={form.clientState} onChange={e => set("clientState", e.target.value)} /></label>
        <label>State Code<input value={form.clientStateCode} onChange={e => set("clientStateCode", e.target.value)} /></label>
      </div></div>
      <InvoiceItems items={form.items} hsn={ctx.hsn} updateItem={updateItem} addItem={() => set("items", [...form.items, emptyItem()])} removeItem={index => set("items", form.items.filter((_, i) => i !== index))} />
      <div className="panel split"><label>Notes<textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></label><label>Terms & Conditions<textarea value={form.terms} onChange={e => set("terms", e.target.value)} /></label></div>
      <div className="panel"><div className="totals"><div><span>Taxable Value</span><strong>{inr(totals.taxableCents)}</strong></div><div><span>CGST</span><strong>{inr(totals.cgstCents)}</strong></div><div><span>SGST</span><strong>{inr(totals.sgstCents)}</strong></div><div><span>IGST</span><strong>{inr(totals.igstCents)}</strong></div><div className="grand"><span>Grand Total</span><strong>{inr(totals.grandTotalCents)}</strong></div><p>Indian Rupees {amountInWords(totals.grandTotalCents)}</p></div></div>
      <div className="form-actions"><button type="button" className="secondary" onClick={() => { setShowForm(false); ctx.clearEditingQuotation(); }}>Close</button><button type="button" className="secondary" onClick={openPreview} disabled={!form.quotationNo}>Preview</button><button type="button" className="secondary" onClick={() => submit("Draft")}>Save Draft</button><button className="primary">Save Sent Quotation</button></div>
    </form>}
    <div className="table-wrap panel">
      <table className="data-table"><thead><tr><th>Quote Number</th><th>Quotation Date</th><th>Valid Till</th><th>Customer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {rows.map(quotation => <tr key={quotation.id}>
        <td><strong>{quotation.quotationNo}</strong></td>
        <td>{formatDate(quotation.quotationDate)}</td>
        <td>{formatDate(quotation.validUntil) || "-"}</td>
        <td>{quotation.clientName}<small>{quotation.clientGstin || "No GSTIN"}</small></td>
        <td className="num">{inr(quotation.totals.grandTotalCents)}</td>
        <td><span className={`badge status-${quotation.quotationStatus.toLowerCase()}`}>{quotation.quotationStatus}</span></td>
        <td><div className="record-actions"><button className="small secondary" onClick={() => setPreview(quotation)}>View</button><button className="small secondary" onClick={() => ctx.editQuotation(quotation)}>Edit</button><button className="small secondary" onClick={() => ctx.duplicateQuotation(quotation)}>Duplicate</button><button className="small secondary" onClick={() => setPreview(quotation)}>Print</button>{quotation.quotationStatus !== "Cancelled" && <button className="small danger" onClick={async () => { const reason = prompt("Cancellation reason is required:"); if (reason && confirm(`Cancel ${quotation.quotationNo}?`)) { await api.quotations.cancel(quotation.id, reason); await ctx.reload(); } }}>Cancel</button>}<button className="small danger" onClick={async () => { const reason = prompt("Deletion reason is required:"); if (reason && confirm(`Delete ${quotation.quotationNo}?`)) { await api.quotations.remove(quotation.id, reason); await ctx.reload(); } }}>Delete</button></div></td>
      </tr>)}
      {!rows.length && <tr><td colSpan="7">No quotations.</td></tr>}
      </tbody></table>
    </div>
    <Modal onClose={() => setPreview(null)}>{preview && <><div className="preview-actions"><button className="primary" onClick={printQuotation}>Print / Save PDF</button></div><QuotationPreview quotation={preview} settings={ctx.settings} /></>}</Modal>
  </section>;
}

function makeBlank(settings) {
  return { quotationNo: "", quotationDate: today(), validUntil: "", gstType: "auto", referenceNo: "", subject: "", customerId: "", clientName: "", clientAddress: "", clientContact: "", clientEmail: "", clientGstin: "", clientState: settings?.state || "Maharashtra", clientStateCode: settings?.stateCode || "27", notes: "", terms: "Prices are valid until the mentioned date.\nTaxes are applicable as shown.", quotationStatus: "Draft", items: [] };
}

function fromQuotation(quotation) {
  return { ...quotation, gstType: quotation.gstOverride ? quotation.gstType : "auto", items: quotation.items.map(item => ({ ...item, rate: item.rate ?? Number(item.rateCents || 0) / 100 })) };
}

function buildPreviewQuotation(form, settings, gstType, totals) {
  const items = form.items.map((item, index) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const rateCents = Math.round(rate * 100);
    return { ...item, id: item.id || `q-preview-${index}`, srNo: index + 1, gstRate: Number(item.gstRate || 0), qty, rateCents, taxableCents: Math.round(qty * rateCents) };
  });
  return { ...form, id: form.id || "preview", gstType, gstOverride: form.gstType !== "auto", companySnapshot: settings, items, totals, amountWords: amountInWords(totals.grandTotalCents) };
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
