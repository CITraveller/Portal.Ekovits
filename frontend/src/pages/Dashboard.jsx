import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { inr } from "../utils/money.js";

export default function Dashboard({ refreshKey = 0 }) {
  const [range, setRange] = useState("month");
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    api.reports.dashboard(range).then(setDashboard).catch(err => setError(err.message));
  }, [range, refreshKey]);
  const cards = dashboard ? [
    ["Total Sales", inr(dashboard.salesCents)],
    ["Taxable Sales", inr(dashboard.taxableCents)],
    ["GST", inr(dashboard.gstCents)],
    ["Paid", inr(dashboard.paidCents)],
    ["Outstanding", inr(dashboard.outstandingCents)],
    ["Invoices", dashboard.invoiceCount],
    ["Drafts", dashboard.draftCount],
    ["Cancelled", dashboard.cancelledCount]
  ] : [];
  return (
    <section className="view active">
      <div className="section-head">
        <div><h1>Dashboard</h1><p>Local PostgreSQL-backed GST invoice records.</p></div>
        <div className="filters">
          {["today", "week", "month", "fy", "all"].map(value => <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{label(value)}</button>)}
        </div>
      </div>
      {error && <div className="notice err-text">{error}</div>}
      <div className="metric-grid">
        {cards.map(([name, value]) => <div className="metric" key={name}><span>{name}</span><strong>{value}</strong></div>)}
      </div>
      <div className="panel">
        <h2>Recent Invoices</h2>
        <div className="compact-list">
          {(dashboard?.recentInvoices || []).map(invoice => (
            <div className="record" key={invoice.invoice_no}>
              <div><div className="record-title">{invoice.invoice_no}</div><small>{invoice.invoice_date}</small></div>
              <div>{invoice.client_name}</div>
              <strong>{inr(invoice.grand_total_cents)}</strong>
              <span className="badge">{invoice.payment_status}</span>
            </div>
          ))}
          {!dashboard?.recentInvoices?.length && <p className="hint">No recent invoices.</p>}
        </div>
      </div>
    </section>
  );
}

function label(value) {
  return ({ today: "Today", week: "This Week", month: "This Month", fy: "Financial Year", all: "All" })[value];
}
