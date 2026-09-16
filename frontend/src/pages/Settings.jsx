import { useState } from "react";
import { api } from "../services/api.js";

export default function Settings({ ctx }) {
  const [form, setForm] = useState(ctx.settings);
  const set = (key, value) => setForm({ ...form, [key]: value });
  const save = async (event) => {
    event.preventDefault();
    await api.settings.update(form);
    ctx.notify("Settings saved.");
    await ctx.reload();
  };
  const upload = async (event) => {
    const fd = new FormData();
    [...event.target.files].forEach(file => fd.append(event.target.name, file));
    await api.settings.assets(fd);
    ctx.notify("Asset uploaded.");
    await ctx.reload();
  };
  return <section className="view active">
    <div className="section-head"><div><h1>Company Settings</h1><p>Future invoices use current settings. Saved invoices retain their historical snapshot.</p></div></div>
    <form className="panel stack" onSubmit={save}>
      <div className="grid two">
        {field("Company Name", "name", form, set)}
        {field("GSTIN", "gstin", form, set)}
        <label>Address<textarea value={form.address || ""} onChange={e => set("address", e.target.value)} /></label>
        {field("State", "state", form, set)}
        {field("State Code", "stateCode", form, set)}
        {field("Contact Numbers", "contact", form, set)}
        {field("Email", "email", form, set, "email")}
        {field("Website", "website", form, set)}
        {field("Bank Name", "bankName", form, set)}
        {field("Account Number", "accountNo", form, set)}
        {field("IFSC", "ifsc", form, set)}
        {field("Branch", "branch", form, set)}
        {field("Authorised Signatory Name", "signatory", form, set)}
        {field("Next Invoice Number", "nextInvoiceNumber", form, set, "number")}
      </div>
      <div className="asset-grid">
        <label>Logo<input name="logo" type="file" accept="image/*" onChange={upload} /></label>
        <label>Company Stamp<input name="stamp" type="file" accept="image/*" onChange={upload} /></label>
        <label>Signature<input name="signature" type="file" accept="image/*" onChange={upload} /></label>
      </div>
      <div className="form-actions"><button className="primary">Save Settings</button></div>
    </form>
  </section>;
}

function field(label, key, form, set, type = "text") {
  return <label>{label}<input type={type} value={form[key] || ""} onChange={e => set(key, e.target.value)} /></label>;
}
