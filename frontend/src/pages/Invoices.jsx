import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { api } from "../services/api.js";
import { inr } from "../utils/money.js";
import { Modal } from "../components/Modal.jsx";
import { InvoicePreview, printInvoice } from "../components/InvoicePreview.jsx";

export default function Invoices({ ctx, initialFilter = "all" }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const [openActions, setOpenActions] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => { setFilter(initialFilter || "all"); }, [initialFilter]);
  const rows = useMemo(() => ctx.invoices
    .filter(i => [i.invoiceNo, i.clientName, i.clientGstin, i.paymentStatus, i.invoiceStatus, i.source, i.totals.grandTotalCents / 100].join(" ").toLowerCase().includes(search.toLowerCase()))
    .filter(i => filter === "all"
      || (filter === "system" && !i.imported)
      || (filter === "cancelled" && i.invoiceStatus === "Cancelled")
      || (filter === "draft" && i.invoiceStatus === "Draft")
      || (filter === "sent" && i.invoiceStatus === "Final")
      || (filter === "paid" && i.paymentStatus === "Paid")
      || (filter === "partial" && i.paymentStatus === "Partially Paid")
      || (filter === "unpaid" && i.paymentStatus === "Unpaid")
      || (filter === "overdue" && isOverdue(i))
      || (filter === "pendingPayment" && i.invoiceStatus !== "Cancelled" && i.paymentStatus !== "Paid")
      || (filter === "pendingGst" && i.invoiceStatus !== "Cancelled" && !i.gstPaid && (i.totals?.totalGstCents || 0) > 0)
      || (filter === "gstPaid" && i.gstPaid)), [ctx.invoices, search, filter]);
  const uploadOriginal = async (invoice, file) => {
    if (!file) return;
    const form = new FormData();
    form.append("document", file);
    try {
      await api.invoices.attachOriginal(invoice.id, form);
      ctx.notify("Original invoice PDF attached.");
      await ctx.reload();
    } catch (err) {
      ctx.notify(err.message, "err");
    }
  };
  const previewImport = async () => {
    if (!importFile) return ctx.notify("Choose a CSV or Excel file first.", "err");
    const form = new FormData();
    form.append("file", importFile);
    setImporting(true);
    try {
      setImportPreview(await api.invoices.previewImport(form));
    } catch (err) {
      ctx.notify(err.message, "err");
    } finally {
      setImporting(false);
    }
  };
  const commitImport = async () => {
    if (!importFile) return;
    const form = new FormData();
    form.append("file", importFile);
    setImporting(true);
    try {
      const result = await api.invoices.commitImport(form);
      ctx.notify(`Imported ${result.successfullyImported} historical invoices.`);
      setImportOpen(false);
      setImportPreview(null);
      setImportFile(null);
      await ctx.reload();
    } catch (err) {
      ctx.notify(err.message, "err");
    } finally {
      setImporting(false);
    }
  };
  const setPaymentStatus = async (invoice, paymentStatus) => {
    if (!confirm(`Mark ${invoice.invoiceNo} as ${paymentStatus}?`)) return;
    await api.invoices.paymentStatus(invoice.id, paymentStatus);
    setOpenActions(null);
    await ctx.reload();
  };
  const setGstStatus = async (invoice, gstPaid) => {
    if (!confirm(`Mark GST for ${invoice.invoiceNo} as ${gstPaid ? "paid" : "pending"}?`)) return;
    await api.invoices.gstStatus(invoice.id, gstPaid);
    setOpenActions(null);
    await ctx.reload();
  };
  const cancelInvoice = async (invoice) => {
    const reason = prompt("Cancellation reason is required:");
    if (reason) {
      setOpenActions(null);
      await api.invoices.cancel(invoice.id, reason);
      await ctx.reload();
    }
  };
  const deleteInvoice = async (invoice) => {
    const reason = prompt("Deletion reason is required. Issued/imported invoices will be hidden, not destroyed:");
    if (reason) {
      setOpenActions(null);
      await api.invoices.remove(invoice.id, reason);
      await ctx.reload();
    }
  };
  return <section className="view active">
    <div className="section-head invoice-page-head">
      <div><h1>Invoices</h1><p>{rows.length} of {ctx.invoices.length} invoices</p></div>
      <div className="actions"><button className="secondary" onClick={() => setImportOpen(true)}>Import Historical</button></div>
    </div>
    <div className="table-wrap panel invoice-ledger">
      <div className="invoice-ledger-toolbar">
        <div className="filters invoice-tabs">
          {["all", "draft", "sent", "paid", "partial", "unpaid", "overdue", "cancelled", "system"].map(id => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{labelFilter(id)}</button>)}
        </div>
        <input className="search invoice-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..." />
      </div>
      <table className="data-table invoice-table"><thead><tr><th>Invoice No</th><th>Customer</th><th>Invoice Date</th><th>Due Date</th><th>Subtotal</th><th>Tax</th><th>Total</th><th>Status</th><th>Payment Status</th><th>Actions</th></tr></thead><tbody>
        {rows.map(invoice => <tr key={invoice.id}>
          <td><strong>{invoice.invoiceNo}</strong></td>
          <td><span className="invoice-customer">{invoice.clientName}</span><small>{invoice.clientGstin || "No GSTIN"}</small></td>
          <td>{formatDate(invoice.invoiceDate)}</td>
          <td className={isOverdue(invoice) ? "err-text" : ""}>{formatDate(invoice.dueDate)}</td>
          <td className="num">{inr(invoice.totals.taxableCents)}</td>
          <td className="num tax-cell">{inr(invoice.totals.totalGstCents)}</td>
          <td className="num">{inr(invoice.totals.grandTotalCents)}</td>
          <td><StatusBadge value={displayInvoiceStatus(invoice)} /></td>
          <td><StatusBadge value={displayPaymentStatus(invoice)} /></td>
          <td><div className="invoice-row-actions">
            <button className="icon-action" aria-label="View invoice" title="View invoice" onClick={() => setPreview(invoice)}><Eye size={17} /></button>
            <button className="icon-action" aria-label="Edit invoice" title="Edit invoice" onClick={() => ctx.editInvoice(invoice)}><Pencil size={17} /></button>
            <button className="icon-action" aria-label="Duplicate invoice" title="Duplicate invoice" onClick={() => ctx.duplicateInvoice(invoice)}><Copy size={17} /></button>
            <button className="icon-action" aria-label="Print or save PDF" title="Print or save PDF" onClick={() => setPreview(invoice)}><FileText size={17} /></button>
            <div className="action-menu">
              <button className="icon-action action-trigger" aria-label="More invoice actions" title="More actions" onClick={() => setOpenActions(openActions === invoice.id ? null : invoice.id)}><MoreHorizontal size={18} /></button>
              {openActions === invoice.id && <div className="action-dropdown">
                {invoice.invoiceStatus !== "Cancelled" && <>
                  <p>Payment Status</p>
                  {["Paid", "Partially Paid", "Unpaid"].map(status => <button key={status} onClick={() => setPaymentStatus(invoice, status)}><span className={invoice.paymentStatus === status ? "check on" : "check"} />{status}</button>)}
                  <p>GST Status</p>
                  <button disabled={!Number(invoice.totals?.totalGstCents || 0)} onClick={() => setGstStatus(invoice, true)}><span className={invoice.gstPaid ? "check on" : "check"} />GST Paid</button>
                  <button disabled={!Number(invoice.totals?.totalGstCents || 0)} onClick={() => setGstStatus(invoice, false)}><span className={!invoice.gstPaid && Number(invoice.totals?.totalGstCents || 0) ? "check on" : "check"} />GST Pending</button>
                </>}
                <p>Documents</p>
                {invoice.originalDocumentPath && <a href={api.invoices.originalDocumentUrl(invoice.id)}>Original PDF</a>}
                {invoice.imported && <label>Attach Original PDF<input type="file" accept="application/pdf" onChange={e => uploadOriginal(invoice, e.target.files?.[0])} /></label>}
                <p>Invoice</p>
                {invoice.invoiceStatus !== "Cancelled" && <button onClick={() => cancelInvoice(invoice)}>Cancel Invoice</button>}
                <button className="danger-row" onClick={() => deleteInvoice(invoice)}><Trash2 size={15} />Delete Invoice</button>
              </div>}
            </div>
          </div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan="10">No invoices.</td></tr>}
      </tbody></table>
      <div className="invoice-ledger-footer"><span>Showing {rows.length ? 1 : 0} to {rows.length} of {rows.length} invoices</span></div>
    </div>
    <Modal onClose={() => setPreview(null)}>{preview && <><div className="preview-actions"><button className="primary" onClick={() => printInvoice(preview, ctx.settings)}>Print / Save PDF</button></div><InvoicePreview invoice={preview} settings={ctx.settings} /></>}</Modal>
    <Modal onClose={() => setImportOpen(false)}>{importOpen && <div className="stack import-panel">
      <div><h2>Import Historical Invoices</h2><p className="hint">Upload a CSV or Excel file. Preview validates every row before anything is inserted.</p></div>
      <div className="actions"><a className="button-link secondary" href={api.invoices.importTemplateUrl}>Download Template</a></div>
      <label>Import File<input type="file" accept=".csv,.xlsx,.xls" onChange={e => { setImportFile(e.target.files?.[0] || null); setImportPreview(null); }} /></label>
      <div className="form-actions"><button className="secondary" onClick={previewImport} disabled={importing}>{importing ? "Checking..." : "Preview Import"}</button><button className="primary" onClick={commitImport} disabled={importing || !importPreview || importPreview.errors?.length}>{importing ? "Importing..." : "Confirm Import"}</button></div>
      {importPreview && <div className="panel">
        <div className="metric-grid import-metrics">
          <div className="metric"><span>Rows Found</span><strong>{importPreview.rowsFound}</strong></div>
          <div className="metric"><span>Valid</span><strong>{importPreview.valid}</strong></div>
          <div className="metric"><span>Warnings</span><strong>{importPreview.warnings}</strong></div>
          <div className="metric"><span>Errors</span><strong>{importPreview.errors.length}</strong></div>
          <div className="metric"><span>Duplicates</span><strong>{importPreview.duplicates}</strong></div>
        </div>
        {!!importPreview.errors.length && <ImportMessages title="Errors" items={importPreview.errors} />}
        {!!importPreview.warningDetails?.length && <ImportMessages title="Warnings" items={importPreview.warningDetails} />}
      </div>}
    </div>}</Modal>
  </section>;
}

function ImportMessages({ title, items }) {
  return <div className="table-wrap"><h2>{title}</h2><table className="data-table"><thead><tr><th>Row</th><th>Invoice</th><th>Message</th></tr></thead><tbody>{items.map((item, index) => <tr key={index}><td>{item.row || "-"}</td><td>{item.invoiceNo || "-"}</td><td>{item.message}</td></tr>)}</tbody></table></div>;
}

function labelFilter(id) {
  return ({ all: "All", pendingPayment: "Pending Payment", system: "System", cancelled: "Cancelled", draft: "Draft", sent: "Sent", paid: "Paid", partial: "Partial", unpaid: "Unpaid", overdue: "Overdue", pendingGst: "Pending GST", gstPaid: "GST Paid" })[id] || id;
}

function StatusBadge({ value }) {
  const key = String(value || "").toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge status-${key}`}>{value}</span>;
}

function displayInvoiceStatus(invoice) {
  if (invoice.invoiceStatus === "Final") return "Sent";
  return invoice.invoiceStatus;
}

function displayPaymentStatus(invoice) {
  if (invoice.invoiceStatus === "Cancelled") return "Cancelled";
  if (!Number(invoice.totals?.totalGstCents || 0) && invoice.paymentStatus === "Unpaid") return "Not Applicable";
  if (isOverdue(invoice)) return "Overdue";
  return invoice.paymentStatus;
}

function isOverdue(invoice) {
  if (!invoice.dueDate || invoice.invoiceStatus === "Cancelled" || invoice.paymentStatus === "Paid") return false;
  const due = new Date(invoice.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
