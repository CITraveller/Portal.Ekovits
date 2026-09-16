import { API_ORIGIN } from "../services/api.js";

const tabs = [
  ["dashboard", "Dashboard"],
  ["invoice", "New Invoice"],
  ["invoices", "Invoices"],
  ["customers", "Customers"],
  ["hsn", "HSN/SAC"],
  ["payments", "Payments"],
  ["reports", "Reports"],
  ["settings", "Settings"],
  ["backup", "Backup"]
];

export function Layout({ activeTab, setActiveTab, settings, user, onLogout, children }) {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className={`brand-mark ${settings?.logoPath ? "has-logo" : ""}`}>
            <span id="brandFallback">EK</span>
            {settings?.logoPath && <img id="brandLogo" src={`${API_ORIGIN}${settings.logoPath}`} alt="Company logo" />}
          </span>
          <div><strong>EKOVITS</strong><span>Invoice & GST Manager</span></div>
        </div>
        <nav className="tabs" aria-label="Primary">
          {tabs.map(([id, label]) => (
            <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>
          ))}
        </nav>
        {user && <div className="user-menu"><span>{user.role}</span><strong>{user.email}</strong><button className="secondary small" onClick={onLogout}>Logout</button></div>}
      </header>
      <main>{children}</main>
    </>
  );
}
