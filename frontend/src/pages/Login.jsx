import { useState } from "react";

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "support@ekovits.com", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const set = (key, value) => setForm({ ...form, [key]: value });

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
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          <span className="brand-mark">EK</span>
          <div><strong>EKOVITS</strong><span>Invoice & GST Manager</span></div>
        </div>
        <div>
          <h1>Employee Login</h1>
          <p>Sign in to access billing, GST records, payments, reports, and settings.</p>
        </div>
        {error && <div className="notice err-text">{error}</div>}
        <label>Email<input type="email" required autoComplete="username" value={form.email} onChange={e => set("email", e.target.value)} disabled={loading} /></label>
        <label>Password
          <span className="password-field">
            <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={form.password} onChange={e => set("password", e.target.value)} disabled={loading} />
            <button type="button" className="secondary small" onClick={() => setShowPassword(!showPassword)} disabled={loading}>{showPassword ? "Hide" : "Show"}</button>
          </span>
        </label>
        <button className="primary" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
      </form>
    </main>
  );
}
