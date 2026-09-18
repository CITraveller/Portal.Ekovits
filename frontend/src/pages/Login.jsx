import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Eye, EyeOff, FileText, Globe2, Lock, Mail, Search, Settings, ShieldCheck } from "lucide-react";
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
      <div className="login-shape login-shape-a" />
      <div className="login-shape login-shape-b" />
      <div className="login-dots login-dots-a" />
      <div className="login-dots login-dots-b" />
      <section className="login-stage">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <div className={`login-logo ${branding?.logoPath ? "has-logo" : ""}`}>
              <span>EKOVITS</span>
              {branding?.logoPath && <img src={`${API_ORIGIN}${branding.logoPath}`} alt={`${branding.name || "EKOVITS"} logo`} />}
            </div>
            <div>
              <h2>Welcome Back</h2>
              <p>Sign in to access your account</p>
            </div>
          </div>
          {error && <div className="notice err-text">{error}</div>}
          <label>Email Address<span className="login-input"><Mail size={19} /><input type="email" required autoComplete="username" placeholder="Enter your email" value={form.email} onChange={e => set("email", e.target.value)} disabled={loading} /></span></label>
          <label>Password
            <span className="password-field">
              <Lock size={19} />
              <input type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={e => set("password", e.target.value)} disabled={loading} />
              <button type="button" className="login-eye" onClick={() => setShowPassword(!showPassword)} disabled={loading} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </span>
          </label>
          <button type="button" className="forgot-link">Forgot password?</button>
          <button className="primary login-submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"} <ArrowRight size={19} /></button>
          <div className="login-divider"><span>or</span></div>
          <div className="login-secure"><ShieldCheck size={20} /><strong>Secure Access</strong></div>
          <p className="login-secure-note">Only authorized personnel can access this portal.</p>
        </form>
        <aside className="login-hero">
          <div>
            <h1>EKOVITS CONSULTING LLP</h1>
            <p>Internal Operations, Invoicing & RFQ, RFP, PO Management Portal.</p>
          </div>
          <div className="login-contact">
            <span><Globe2 size={20} />{branding?.website || "www.ekovits.com"}</span>
            <span><Mail size={20} />{branding?.email || "hello@ekovits.com"}</span>
          </div>
          <div className="login-features">
            <div><span><FileText size={34} /></span><strong>Invoicing<br />Management</strong></div>
            <div><span><Search size={34} /></span><strong>RFQ / RFP<br />Tracking</strong></div>
            <div><span><ClipboardList size={34} /></span><strong>PO<br />Management</strong></div>
            <div><span><Settings size={34} /></span><strong>Internal<br />Operations</strong></div>
          </div>
          <div className="login-mantra"><span />People <b>|</b> Process <b>|</b> Progress <span /></div>
          <p className="login-script">Building<br />A Smarter Tomorrow</p>
        </aside>
      </section>
    </main>
  );
}
