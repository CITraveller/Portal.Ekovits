import { useMemo, useState } from "react";
import { api } from "../services/api.js";
import { inr } from "../utils/money.js";
import { Modal } from "../components/Modal.jsx";
import { InvoicePreview, printInvoice } from "../components/InvoicePreview.jsx";

export default function Invoices({ ctx }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const rows = useMemo(() => ctx.invoices
    .filter(i => [i.invoiceNo, i.clientName, i.clientGstin, i.paymentStatus, i.invoiceStatus, i.source, i.totals.grandTotalCents / 100].join(" ").toLowerCase().includes(search.toLowerCase()))
    .filter(i => filter === "all"
      || (filter === "system" && !i.imported)
      || (filter === "imported" && i.imported)
      || (filter === "cancelled" && i.invoiceStatus === "Cancelled")
      || (filter === "paid" && i.paymentStatus === "Paid")
      || (filter === "unpaid" && i.paymentStatus === "Unpaid")), [ctx.invoices, search, filter]);
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
  return <section className="view active">
    <div className="section-head">
      <div><h1>Invoice History</h1><p>View, correct, print, duplicate, import historical invoices, or cancel invoices.</p></div>
      <div className="actions"><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, client, GSTIN, amount, status" /><button className="primary" onClick={() => setImportOpen(true)}>Import Historical</button></div>
    </div>
    <div className="filters">
      {["all", "system", "imported", "cancelled", "paid", "unpaid"].map(id => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{labelFilter(id)}</button>)}
    </div>
    <div className="record-list">
      {rows.map(invoice => <div className={`record ${invoice.invoiceStatus.toLowerCase()}`} key={invoice.id}>
        <div><div className="record-title">{invoice.invoiceNo} {invoice.imported && <span className="badge imported">Imported</span>}</div><small>{formatDate(invoice.invoiceDate)} · Revision {invoice.revision}</small></div>
        <div>{invoice.clientName}<small>{invoice.clientGstin || "No GSTIN"}</small></div>
        <div><strong>{inr(invoice.totals.grandTotalCents)}</strong><small>{invoice.paymentStatus}</small></div>
        <div className="record-actions">
          <button className="small secondary" onClick={() => setPreview(invoice)}>View</button>
          <button className="small secondary" onClick={() => ctx.editInvoice(invoice)}>Edit</button>
          <button className="small secondary" onClick={() => ctx.duplicateInvoice(invoice)}>Duplicate</button>
          <button className="small secondary" onClick={() => setPreview(invoice)}>Print</button>
          {invoice.originalDocumentPath && <a className="button-link small secondary" href={api.invoices.originalDocumentUrl(invoice.id)}>Original PDF</a>}
          {invoice.imported && <label className="file-action small secondary">Attach PDF<input type="file" accept="application/pdf" onChange={e => uploadOriginal(invoice, e.target.files?.[0])} /></label>}
          {invoice.invoiceStatus !== "Cancelled" && <button className="small danger" onClick={async () => { const reason = prompt("Cancellation reason is required:"); if (reason) { await api.invoices.cancel(invoice.id, reason); await ctx.reload(); } }}>Cancel</button>}
          <button className="small danger" onClick={async () => { const reason = prompt("Deletion reason is required. Issued/imported invoices will be hidden, not destroyed:"); if (reason) { await api.invoices.remove(invoice.id, reason); await ctx.reload(); } }}>Delete</button>
        </div>
      </div>)}
      {!rows.length && <div className="panel">No invoices.</div>}
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
  return ({ all: "All", system: "Normal/System Generated", imported: "Imported/Historical", cancelled: "Cancelled", paid: "Paid", unpaid: "Unpaid" })[id] || id;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "";
}
