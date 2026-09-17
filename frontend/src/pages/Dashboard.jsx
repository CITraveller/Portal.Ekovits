import { useEffect, useState } from "react";
import { api } from "../services/api.js";

export default function Dashboard({ ctx, refreshKey = 0 }) {
  const [range, setRange] = useState("month");
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    api.reports.dashboard(range).then(setDashboard).catch(err => setError(err.message));
  }, [range, refreshKey]);
  const cards = dashboard ? [
    ["Pending Invoices for Payment", dashboard.pendingPaymentCount, () => ctx.openInvoiceFilter("pendingPayment")],
    ["Paid Invoices", dashboard.paidInvoiceCount, () => ctx.openInvoiceFilter("paid")],
    ["Pending for GST Payment", dashboard.pendingGstCount, () => ctx.openInvoiceFilter("pendingGst")],
    ["GST Paid Invoices", dashboard.gstPaidCount, () => ctx.openInvoiceFilter("gstPaid")],
    ["Cancelled Invoices", dashboard.cancelledCount, () => ctx.openInvoiceFilter("cancelled")],
    ["Cancelled Quotations", dashboard.cancelledQuotationCount, () => ctx.openQuotationFilter("Cancelled")],
    ["Draft Invoices", dashboard.draftCount, () => ctx.openInvoiceFilter("draft")],
    ["Draft Quotations", dashboard.draftQuotationCount, () => ctx.openQuotationFilter("Draft")]
  ] : [];
  return (
    <section className="view active">
      <div className="section-head">
        <div><h1>Dashboard</h1><p>Actionable invoice, GST, and quotation work queues.</p></div>
        <div className="filters">
          {["today", "week", "month", "fy", "all"].map(value => <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{label(value)}</button>)}
        </div>
      </div>
      {error && <div className="notice err-text">{error}</div>}
      <div className="metric-grid">
        {cards.map(([name, value, onClick]) => <button className="metric metric-button" key={name} onClick={onClick}><span>{name}</span><strong>{value}</strong></button>)}
      </div>
    </section>
  );
}

function label(value) {
  return ({ today: "Today", week: "This Week", month: "This Month", fy: "Financial Year", all: "All" })[value];
}
