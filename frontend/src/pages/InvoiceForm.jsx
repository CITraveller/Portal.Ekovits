import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api.js";
import { calculateTotals, resolvedGstType } from "../utils/calculations.js";
import { amountInWords, inr } from "../utils/money.js";
import { Modal } from "../components/Modal.jsx";
import { InvoicePreview, printInvoice } from "../components/InvoicePreview.jsx";

const emptyItem = () => ({ description: "", hsn: "", gstRate: 18, qty: 1, rate: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoiceForm({ ctx, editingInvoice }) {
  const settings = ctx.settings;
  const isEditing = Boolean(editingInvoice?.id && !editingInvoice?.duplicateSourceId);
  const [form, setForm] = useState(makeBlank(settings));
  const [preview, setPreview] = useState(null);
  const [numberLoading, setNumberLoading] = useState(false);
  const reservedForBlankRef = useRef(false);
  useEffect(() => {
    if (editingInvoice) {
      reservedForBlankRef.current = false;
      const next = editingInvoice.duplicateSourceId ? { ...fromInvoice(editingInvoice), invoiceNo: "", invoiceStatus: "Draft", paymentStatus: "Unpaid" } : fromInvoice(editingInvoice);
      setForm(next);
      if (editingInvoice.duplicateSourceId) {
        setNumberLoading(true);
        api.invoices.reserveNumber()
          .then(result => setForm(current => ({ ...current, invoiceNo: result.invoiceNo })))
          .catch(err => ctx.notify(`Invoice number could not be generated: ${err.message}`, "err"))
          .finally(() => setNumberLoading(false));
      }
      return;
    }
    if (reservedForBlankRef.current) return;
    reservedForBlankRef.current = true;
    setNumberLoading(true);
    setForm(makeBlank(settings));
    api.invoices.reserveNumber()
      .then(result => {
        setForm(current => ({ ...current, invoiceNo: result.invoiceNo }));
      })
      .catch(err => {
        reservedForBlankRef.current = false;
        ctx.notify(`Invoice number could not be generated: ${err.message}`, "err");
      })
      .finally(() => {
        setNumberLoading(false);
      });
  }, [editingInvoice, settings]);
  const gstType = resolvedGstType(settings.state, form.clientState, form.gstType);
  const totals = useMemo(() => calculateTotals(form.items, gstType), [form.items, gstType]);
  const set = (key, value) => setForm({ ...form, [key]: value });
  const updateItem = (index, next) => set("items", form.items.map((item, i) => i === index ? { ...item, ...next } : item));
  const selectCustomer = (id) => {
    const c = ctx.customers.find(customer => customer.id === id);
    if (!c) return set("customerId", "");
    setForm({ ...form, customerId: id, clientName: c.name, clientAddress: c.billingAddress, shippingAddress: c.shippingAddress, contactPerson: c.contactPerson, clientContact: c.contactNumber, clientEmail: c.email, clientGstin: c.gstin, clientState: c.state, clientStateCode: c.stateCode });
  };
  const submit = async (status) => {
    try {
      const payload = { ...form, gstType, invoiceStatus: status };
      if (!isEditing) {
        // The invoiceNo shown while filling the form is only a preview.
        // Drop it here so the server reserves the real, authoritative
        // number at the moment the invoice is actually saved.
        delete payload.invoiceNo;
      }
      isEditing ? await api.invoices.update(editingInvoice.id, payload) : await api.invoices.create(payload);
      ctx.notify(status === "Final" ? "Final invoice saved." : "Draft invoice saved.");
      ctx.clearEditingInvoice();
      await ctx.reload();
      startNewInvoice();
    } catch (err) {
      ctx.notify(err.message, "err");
    }
  };
  const startNewInvoice = () => {
    reservedForBlankRef.current = false;
    ctx.clearEditingInvoice();
    setPreview(null);
    setForm(makeBlank(settings));
  };
  const openPreview = () => setPreview(buildPreviewInvoice(form, settings, gstType, totals));
  return (
    <section className="view active">
      <div className="section-head">
        <div><h1>{isEditing ? `Edit Invoice ${editingInvoice.invoiceNo}` : editingInvoice?.duplicateSourceId ? "Duplicate Invoice" : "New Invoice"}</h1><p>Invoices are saved through Express into PostgreSQL.</p></div>
        <button className="secondary" onClick={startNewInvoice}>Clear</button>
      </div>
      {isEditing && editingInvoice?.invoiceStatus === "Final" && <div className="notice">Final invoice correction mode: enter a reason before saving changes.</div>}
      <form className="stack" onSubmit={e => { e.preventDefault(); submit("Final"); }}>
        <div className="panel">
          <h2>Invoice Details</h2>
          <div className="grid four">
            <label>Invoice Number<input readOnly value={form.invoiceNo || (numberLoading ? "Generating..." : "")} /></label>
            <label>Invoice Date<input type="date" required value={form.invoiceDate} onChange={e => set("invoiceDate", e.target.value)} /></label>
            <label>Due Date<input type="date" value={form.dueDate || ""} onChange={e => set("dueDate", e.target.value)} /></label>
            <label>Place of Supply<input value={form.placeOfSupply} onChange={e => set("placeOfSupply", e.target.value)} /></label>
            <label>GST Treatment<select value={form.gstType} onChange={e => set("gstType", e.target.value)}><option value="auto">Auto from states</option><option value="intra">CGST + SGST</option><option value="inter">IGST</option></select></label>
            <label>Reverse Charge<select value={form.reverseCharge} onChange={e => set("reverseCharge", e.target.value)}><option>No</option><option>Yes</option></select></label>
            <label>Payment Terms<input value={form.paymentTerms} onChange={e => set("paymentTerms", e.target.value)} /></label>
            <label>Reference / PO<input value={form.referenceNo} onChange={e => set("referenceNo", e.target.value)} /></label>
          </div>
        </div>
        <div className="panel">
          <h2>Bill To</h2>
          <div className="grid two">
            <label>Select Existing Client<select value={form.customerId || ""} onChange={e => selectCustomer(e.target.value)}><option value="">Select customer</option>{ctx.customers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Client Name<input required value={form.clientName} onChange={e => set("clientName", e.target.value)} /></label>
            <label>Billing Address<textarea required value={form.clientAddress} onChange={e => set("clientAddress", e.target.value)} /></label>
            <label>Shipping Address<textarea value={form.shippingAddress} onChange={e => set("shippingAddress", e.target.value)} /></label>
            <label>Contact Person<input value={form.contactPerson} onChange={e => set("contactPerson", e.target.value)} /></label>
            <label>Contact Number<input value={form.clientContact} onChange={e => set("clientContact", e.target.value)} /></label>
            <label>Email ID<input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} /></label>
            <label>GSTIN<input maxLength="15" value={form.clientGstin} onChange={e => set("clientGstin", e.target.value.toUpperCase())} /></label>
            <label>State<input value={form.clientState} onChange={e => set("clientState", e.target.value)} /></label>
            <label>State Code<input value={form.clientStateCode} onChange={e => set("clientStateCode", e.target.value)} /></label>
          </div>
        </div>
        <InvoiceItems items={form.items} hsn={ctx.hsn} updateItem={updateItem} addItem={() => set("items", [...form.items, emptyItem()])} removeItem={index => set("items", form.items.filter((_, i) => i !== index))} />
        <InvoiceTotals form={form} set={set} totals={totals} />
        {isEditing && editingInvoice?.invoiceStatus === "Final" && <div className="panel"><h2>Edit Reason</h2><label>Reason for correction<textarea required value={form.editReason || ""} onChange={e => set("editReason", e.target.value)} /></label></div>}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={openPreview} disabled={!form.invoiceNo}>Preview Invoice</button>
          <button type="button" className="secondary" onClick={() => submit("Draft")}>Save Draft</button>
          <button className="primary">Save Final Invoice</button>
        </div>
      </form>
      <Modal onClose={() => setPreview(null)}>{preview && <><div className="preview-actions"><button className="primary" onClick={() => printInvoice(preview, ctx.settings)}>Print / Save PDF</button></div><InvoicePreview invoice={preview} settings={ctx.settings} /></>}</Modal>
    </section>
  );
}

export function InvoiceItems({ items, hsn, updateItem, addItem, removeItem }) {
  return <div className="panel"><div className="inline-title"><h2>Line Items</h2><button type="button" className="primary small" onClick={addItem}>Add Line</button></div><div className="item-table">
    <div className="item-head"><span>Sr.</span><span>Description</span><span>HSN/SAC</span><span>GST %</span><span>Qty</span><span>Rate</span><span>Taxable</span><span></span></div>
    {items.map((item, index) => <div className="item-row" key={index}>
      <span className="sr">{index + 1}</span>
      <textarea className="desc" value={item.description} onChange={e => updateItem(index, { description: e.target.value })} />
      <input className="hsn" list="hsnCodes" value={item.hsn} onChange={e => {
        const h = hsn.find(x => x.code === e.target.value);
        updateItem(index, h ? { hsn: h.code, gstRate: h.gstRate } : { hsn: e.target.value });
      }} />
      <input className="gst" type="number" step="0.01" value={item.gstRate} onChange={e => updateItem(index, { gstRate: e.target.value })} />
      <input className="qty" type="number" step="0.001" value={item.qty} onChange={e => updateItem(index, { qty: e.target.value })} />
      <input className="rate" type="number" step="0.01" value={item.rate} onChange={e => updateItem(index, { rate: e.target.value })} />
      <span className="taxable">{inr(Math.round(Number(item.qty || 0) * Number(item.rate || 0) * 100))}</span>
      <button type="button" className="danger small remove" onClick={() => removeItem(index)}>x</button>
    </div>)}
    <datalist id="hsnCodes">{hsn.map(h => <option key={h.id} value={h.code}>{h.description} - {h.gstRate}%</option>)}</datalist>
  </div></div>;
}

export function InvoiceTotals({ form, set, totals }) {
  return <div className="panel split">
    <label>Terms & Conditions / Notes<textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></label>
    <div className="totals">
      <div><span>Taxable Value</span><strong>{inr(totals.taxableCents)}</strong></div>
      <div><span>CGST</span><strong>{inr(totals.cgstCents)}</strong></div>
      <div><span>SGST</span><strong>{inr(totals.sgstCents)}</strong></div>
      <div><span>IGST</span><strong>{inr(totals.igstCents)}</strong></div>
      <div><span>Total GST</span><strong>{inr(totals.totalGstCents)}</strong></div>
      <div><span>Round Off</span><strong>{inr(totals.roundOffCents)}</strong></div>
      <div className="grand"><span>Grand Total</span><strong>{inr(totals.grandTotalCents)}</strong></div>
      <p>Indian Rupees {amountInWords(totals.grandTotalCents)}</p>
    </div>
  </div>;
}

function makeBlank(settings) {
  return { invoiceNo: "", invoiceDate: today(), dueDate: "", placeOfSupply: settings?.state || "Maharashtra", reverseCharge: "No", gstType: "auto", paymentTerms: "Due on receipt", referenceNo: "", customerId: "", clientName: "", clientAddress: "", shippingAddress: "", contactPerson: "", clientContact: "", clientEmail: "", clientGstin: "", clientState: settings?.state || "Maharashtra", clientStateCode: settings?.stateCode || "27", notes: "", items: [] };
}

function fromInvoice(invoice) {
  return { ...invoice, gstType: invoice.gstOverride ? invoice.gstType : "auto", items: invoice.items.map(item => ({ ...item, rate: item.rate ?? Number(item.rateCents || 0) / 100 })), editReason: "" };
}

function buildPreviewInvoice(form, settings, gstType, totals) {
  const items = form.items.map((item, index) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    const rateCents = Math.round(rate * 100);
    return {
      ...item,
      id: item.id || `preview-${index}`,
      srNo: index + 1,
      gstRate: Number(item.gstRate || 0),
      qty,
      rateCents,
      taxableCents: Math.round(qty * rateCents)
    };
  });
  return {
    ...form,
    id: form.id || "preview",
    gstType,
    gstOverride: form.gstType !== "auto",
    invoiceStatus: form.invoiceStatus || "Draft",
    paymentStatus: form.paymentStatus || "Unpaid",
    companySnapshot: settings,
    items,
    totals,
    amountWords: amountInWords(totals.grandTotalCents)
  };
}
