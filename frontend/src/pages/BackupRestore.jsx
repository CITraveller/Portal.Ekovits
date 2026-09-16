import { useState } from "react";
import { api } from "../services/api.js";

export default function BackupRestore({ ctx }) {
  const [message, setMessage] = useState("");
  const downloadJson = async () => {
    const backup = await api.backup.json();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "EKOVITS_PostgreSQL_Backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const restoreJson = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const payload = JSON.parse(await file.text());
    const result = await api.backup.restoreJson(payload);
    setMessage(result.message);
    await ctx.reload();
  };
  return <section className="view active">
    <div className="section-head"><div><h1>Backup & Restore</h1><p>PostgreSQL is the primary database. Exports are generated from the database.</p></div></div>
    <div className="grid two">
      <div className="panel stack"><h2>Export</h2><button className="primary" onClick={downloadJson}>Backup All Data (JSON)</button><a className="secondary" href={api.backup.excelUrl}>Export Complete Database (XLSX)</a><p className="hint">For full database backups, use `pg_dump` from the README.</p></div>
      <div className="panel stack"><h2>Restore / Import</h2><label>Validate JSON backup<input type="file" accept=".json" onChange={restoreJson} /></label><p className="hint">{message || "JSON restore is validated server-side. Destructive restore should be performed intentionally through controlled scripts."}</p></div>
    </div>
    <div className="panel"><h2>Audit Log</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Action</th><th>Entity</th><th>Invoice</th><th>Description</th><th>Reason</th><th>Date</th></tr></thead><tbody>
      {ctx.audit.map(a => <tr key={a.id}><td>{a.action}</td><td>{a.entityType}</td><td>{a.invoiceNo}</td><td>{a.description}</td><td>{a.reason}</td><td>{new Date(a.createdAt).toLocaleString("en-IN")}</td></tr>)}
      {!ctx.audit.length && <tr><td colSpan="6">No audit records.</td></tr>}
    </tbody></table></div></div>
  </section>;
}
