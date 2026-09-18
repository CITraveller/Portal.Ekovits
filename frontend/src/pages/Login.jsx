import { useEffect, useState } from "react";
import { API_ORIGIN, api } from "../services/api.js";

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "support@ekovits.com", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState(null);
  const set = (key, value) => setForm({ ...form, [key]: value });

  useEffect(() => {
    api.auth.branding().then(setBranding).catch(() => setBranding(null));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (!form.email.trim() || !form.password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onLogin(form);
    } catch (err) {
      const message = err.message || "Login failed";
      setError(message.toLowerCase().includes("invalid") ? "Invalid email or password." : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="login-stage">
        <div className="login-hero">
          <div className={`login-logo ${branding?.logoPath ? "has-logo" : ""}`}>
            <span>EK</span>
            {branding?.logoPath && <img src={`${API_ORIGIN}${branding.logoPath}`} alt={`${branding.name || "EKOVITS"} logo`} />}
          </div>
          <div>
            <h1>EKOVITS CONSULTING LLP</h1>
            <p>Internal Operations, Invoicing & RFQ, RFP, PO Management Portal.</p>
          </div>
          <div className="login-contact">
            <span>{branding?.website || "www.ekovits.com"}</span>
            <span>{branding?.email || "hello@ekovits.com"}</span>
          </div>
        </div>
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <div className="brand login-brand">
              <span className={`brand-mark ${branding?.logoPath ? "has-logo" : ""}`}>
                <span id="brandFallback">EK</span>
                {branding?.logoPath && <img src={`${API_ORIGIN}${branding.logoPath}`} alt="" />}
              </span>
              <div><strong>EKOVITS</strong><span>Invoice & GST Manager</span></div>
            </div>
            <div>
              <h2>Employee Login</h2>
              <p>Use your authorized employee credentials.</p>
            </div>
          </div>
          {error && <div className="notice err-text">{error}</div>}
          <label>Email<input type="email" required autoComplete="username" value={form.email} onChange={e => set("email", e.target.value)} disabled={loading} /></label>
          <label>Password
            <span className="password-field">
              <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={form.password} onChange={e => set("password", e.target.value)} disabled={loading} />
              <button type="button" className="secondary small" onClick={() => setShowPassword(!showPassword)} disabled={loading}>{showPassword ? "Hide" : "Show"}</button>
            </span>
          </label>
          <button className="primary login-submit" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
        </form>
      </section>
    </main>
  );
}
