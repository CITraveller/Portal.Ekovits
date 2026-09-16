import { useEffect, useMemo, useState } from "react";
import { api } from "./services/api.js";
import { Layout } from "./layouts/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import InvoiceForm from "./pages/InvoiceForm.jsx";
import Invoices from "./pages/Invoices.jsx";
import Customers from "./pages/Customers.jsx";
import HsnSac from "./pages/HsnSac.jsx";
import Payments from "./pages/Payments.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import BackupRestore from "./pages/BackupRestore.jsx";
import Login from "./pages/Login.jsx";
import { Toast } from "./components/Toast.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState({ settings: null, customers: [], hsn: [], invoices: [], payments: [], audit: [] });
  const [toast, setToast] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const notify = (message, type = "") => setToast({ message, type, at: Date.now() });
  const reload = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [settings, customers, hsn, invoices, payments, audit] = await Promise.all([
        api.settings.get(),
        api.customers.list(),
        api.hsn.list(),
        api.invoices.list(),
        api.payments.list(),
        api.audit()
      ]);
      setData({ settings, customers, hsn, invoices, payments, audit });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.auth.session()
      .then(sessionUser => setUser(sessionUser))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => { if (user) reload(); }, [user]);

  const login = async (credentials) => {
    const loggedIn = await api.auth.login(credentials);
    setUser(loggedIn);
    notify("Logged in.");
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setData({ settings: null, customers: [], hsn: [], invoices: [], payments: [], audit: [] });
    setActiveTab("dashboard");
    notify("Logged out.");
  };

  const ctx = useMemo(() => ({
    ...data,
    reload,
    notify,
    editInvoice(invoice) {
      setEditingInvoice(invoice);
      setActiveTab("invoice");
    },
    clearEditingInvoice() {
      setEditingInvoice(null);
    }
  }), [data]);

  if (authLoading) {
    return <><div className="auth-shell"><div className="panel">Checking employee session...</div></div><Toast toast={toast} /></>;
  }

  if (!user) {
    return <><Login onLogin={login} /><Toast toast={toast} /></>;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} settings={data.settings} user={user} onLogout={logout}>
      {loading && <div className="panel">Loading PostgreSQL-backed data...</div>}
      {error && <div className="notice err-text">API error: {error}</div>}
      {!loading && !error && activeTab === "dashboard" && <Dashboard ctx={ctx} />}
      {!loading && !error && activeTab === "invoice" && <InvoiceForm ctx={ctx} editingInvoice={editingInvoice} />}
      {!loading && !error && activeTab === "invoices" && <Invoices ctx={ctx} />}
      {!loading && !error && activeTab === "customers" && <Customers ctx={ctx} />}
      {!loading && !error && activeTab === "hsn" && <HsnSac ctx={ctx} />}
      {!loading && !error && activeTab === "payments" && <Payments ctx={ctx} />}
      {!loading && !error && activeTab === "reports" && <Reports ctx={ctx} />}
      {!loading && !error && activeTab === "settings" && <Settings ctx={ctx} />}
      {!loading && !error && activeTab === "backup" && <BackupRestore ctx={ctx} />}
      <Toast toast={toast} />
    </Layout>
  );
}
