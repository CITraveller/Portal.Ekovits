import { useState } from "react";
import { api } from "../services/api.js";
import { inr } from "../utils/money.js";
import { Modal } from "../components/Modal.jsx";

export default function Payments({ ctx }) {
  const [invoice, setInvoice] = useState(null);
  return <section className="view active">
    <div className="section-head"><div><h1>Payments</h1><p>Outstanding and payment status tracking.</p></div></div>
    <div className="table-wrap panel"><table className="data-table"><thead><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>
      {ctx.invoices.map(i => <tr key={i.id}><td>{i.invoiceNo}</td><td>{i.clientName}</td><td className="num">{inr(i.totals.grandTotalCents)}</td><td className="num">{inr(i.amountPaidCents)}</td><td className="num">{inr(i.balanceCents)}</td><td>{i.paymentStatus}</td><td><button className="small primary" onClick={() => setInvoice(i)}>Add Payment</button></td></tr>)}
      {!ctx.invoices.length && <tr><td colSpan="7">No invoices.</td></tr>}
    </tbody></table></div>
    <div className="panel"><h2>Payment Entries</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Notes</th></tr></thead><tbody>
      {ctx.payments.map(p => <tr key={p.id}><td>{p.invoiceNo}</td><td>{formatDate(p.paymentDate)}</td><td className="num">{inr(p.amountCents)}</td><td>{p.paymentMode}</td><td>{p.reference}</td><td>{p.notes}</td></tr>)}
      {!ctx.payments.length && <tr><td colSpan="6">No payments recorded.</td></tr>}
    </tbody></table></div></div>
    <Modal onClose={() => setInvoice(null)}>{invoice && <PaymentModal invoice={invoice} ctx={ctx} onClose={() => setInvoice(null)} />}</Modal>
  </section>;
}

export function PaymentModal({ invoice, ctx, onClose }) {
  const [form, setForm] = useState({ invoiceId: invoice.id, paymentDate: new Date().toISOString().slice(0, 10), amount: (invoice.balanceCents / 100).toFixed(2), paymentMode: "", reference: "", notes: "" });
  const set = (key, value) => setForm({ ...form, [key]: value });
  const save = async (event) => {
    event.preventDefault();
    try {
      await api.payments.create(form);
      ctx.notify("Payment saved.");
      await ctx.reload();
      onClose();
    } catch (err) {
      ctx.notify(err.message, "err");
    }
  };
  return <form className="stack" onSubmit={save}><h2>Payment for {invoice.invoiceNo}</h2><div className="grid two">
    <label>Payment Date<input type="date" value={form.paymentDate} onChange={e => set("paymentDate", e.target.value)} /></label>
    <label>Amount Paid<input type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} /></label>
    <label>Payment Mode<input value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)} /></label>
    <label>Reference<input value={form.reference} onChange={e => set("reference", e.target.value)} /></label>
  </div><label>Notes<textarea value={form.notes} onChange={e => set("notes", e.target.value)} /></label><button className="primary">Save Payment</button></form>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
