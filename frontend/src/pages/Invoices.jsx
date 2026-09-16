import { useMemo, useState } from "react";
import { api } from "../services/api.js";
import { inr } from "../utils/money.js";
import { Modal } from "../components/Modal.jsx";
import { InvoicePreview, printInvoice } from "../components/InvoicePreview.jsx";

export default function Invoices({ ctx }) {
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);
  const rows = useMemo(() => ctx.invoices.filter(i => [i.invoiceNo, i.clientName, i.clientGstin, i.paymentStatus, i.invoiceStatus, i.totals.grandTotalCents / 100].join(" ").toLowerCase().includes(search.toLowerCase())), [ctx.invoices, search]);
  return <section className="view active">
    <div className="section-head"><div><h1>Invoice History</h1><p>View, correct, print, duplicate, mark payment, or cancel invoices.</p></div><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, client, GSTIN, amount, status" /></div>
    <div className="record-list">
      {rows.map(invoice => <div className={`record ${invoice.invoiceStatus.toLowerCase()}`} key={invoice.id}>
        <div><div className="record-title">{invoice.invoiceNo}</div><small>{formatDate(invoice.invoiceDate)} · Revision {invoice.revision}</small></div>
        <div>{invoice.clientName}<small>{invoice.clientGstin || "No GSTIN"}</small></div>
        <div><strong>{inr(invoice.totals.grandTotalCents)}</strong><small>{invoice.paymentStatus}</small></div>
        <div className="record-actions">
          <button className="small secondary" onClick={() => setPreview(invoice)}>View</button>
          <button className="small secondary" onClick={() => ctx.editInvoice(invoice)}>Edit</button>
          <button className="small secondary" onClick={async () => { await api.invoices.duplicate(invoice.id); await ctx.reload(); }}>Duplicate</button>
          <button className="small secondary" onClick={() => setPreview(invoice)}>Print</button>
          {invoice.invoiceStatus !== "Cancelled" && <button className="small danger" onClick={async () => { const reason = prompt("Cancellation reason is required:"); if (reason) { await api.invoices.cancel(invoice.id, reason); await ctx.reload(); } }}>Cancel</button>}
        </div>
      </div>)}
      {!rows.length && <div className="panel">No invoices.</div>}
    </div>
    <Modal onClose={() => setPreview(null)}>{preview && <><div className="preview-actions"><button className="primary" onClick={() => printInvoice(preview, ctx.settings)}>Print / Save PDF</button></div><InvoicePreview invoice={preview} settings={ctx.settings} /></>}</Modal>
  </section>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
