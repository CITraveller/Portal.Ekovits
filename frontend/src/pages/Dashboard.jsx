import { useMemo } from "react";
import { inr } from "../utils/money.js";

export default function Dashboard({ ctx, refreshKey = 0 }) {
  const dashboard = useMemo(() => buildDashboard(ctx.invoices || [], ctx.quotations || []), [ctx.invoices, ctx.quotations, refreshKey]);
  const summaryCards = [
    ["Total Invoice Value", inr(dashboard.salesCents), "All active invoices"],
    ["Outstanding", inr(dashboard.outstandingCents), "Unpaid and partial"],
    ["Total GST", inr(dashboard.gstCents), "Active invoice GST"],
    ["Invoice Count", dashboard.invoiceCount, "Active invoices"]
  ];
  const queueCards = [
    ["Pending Payment", dashboard.pendingPaymentCount, () => ctx.openInvoiceFilter("pendingPayment")],
    ["Paid Invoices", dashboard.paidInvoiceCount, () => ctx.openInvoiceFilter("paid")],
    ["Pending GST", dashboard.pendingGstCount, () => ctx.openInvoiceFilter("pendingGst")],
    ["GST Paid", dashboard.gstPaidCount, () => ctx.openInvoiceFilter("gstPaid")],
    ["Cancelled Invoices", dashboard.cancelledCount, () => ctx.openInvoiceFilter("cancelled")],
    ["Cancelled Quotations", dashboard.cancelledQuotationCount, () => ctx.openQuotationFilter("Cancelled")],
    ["Draft Invoices", dashboard.draftCount, () => ctx.openInvoiceFilter("draft")],
    ["Draft Quotations", dashboard.draftQuotationCount, () => ctx.openQuotationFilter("Draft")]
  ];
  return (
    <section className="view active">
      <div className="section-head">
        <div><h1>Dashboard</h1><p>Synced from the same invoice and quotation data used by the work lists.</p></div>
      </div>
      <div className="metric-grid dashboard-summary">
        {summaryCards.map(([name, value, helper]) => <div className="metric" key={name}><span>{name}</span><strong>{value}</strong><small>{helper}</small></div>)}
      </div>
      <div className="panel dashboard-panel">
        <div className="inline-title"><h2>Work Queues</h2><p className="hint">Live list counts</p></div>
        <div className="metric-grid dashboard-queues">
          {queueCards.map(([name, value, onClick]) => <button className="metric metric-button" key={name} onClick={onClick}><span>{name}</span><strong>{value}</strong></button>)}
        </div>
      </div>
    </section>
  );
}

function buildDashboard(invoices, quotations) {
  const activeInvoices = invoices.filter(invoice => invoice.invoiceStatus !== "Cancelled");
  const salesCents = sum(activeInvoices, invoice => invoice.totals?.grandTotalCents);
  const paidCents = sum(activeInvoices, invoice => invoice.amountPaidCents || (invoice.paymentStatus === "Paid" ? invoice.totals?.grandTotalCents : 0));
  return {
    salesCents,
    paidCents,
    outstandingCents: Math.max(0, salesCents - paidCents),
    gstCents: sum(activeInvoices, invoice => invoice.totals?.totalGstCents),
    invoiceCount: activeInvoices.length,
    draftCount: invoices.filter(invoice => invoice.invoiceStatus === "Draft").length,
    cancelledCount: invoices.filter(invoice => invoice.invoiceStatus === "Cancelled").length,
    pendingPaymentCount: activeInvoices.filter(invoice => invoice.paymentStatus !== "Paid").length,
    paidInvoiceCount: activeInvoices.filter(invoice => invoice.paymentStatus === "Paid").length,
    pendingGstCount: activeInvoices.filter(invoice => !invoice.gstPaid && Number(invoice.totals?.totalGstCents || 0) > 0).length,
    gstPaidCount: activeInvoices.filter(invoice => invoice.gstPaid).length,
    draftQuotationCount: quotations.filter(quotation => quotation.quotationStatus === "Draft").length,
    cancelledQuotationCount: quotations.filter(quotation => quotation.quotationStatus === "Cancelled").length
  };
}

function sum(rows, picker) {
  return rows.reduce((total, row) => total + Number(picker(row) || 0), 0);
}
