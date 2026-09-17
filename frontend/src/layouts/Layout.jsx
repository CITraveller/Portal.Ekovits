import { API_ORIGIN } from "../services/api.js";
import { BarChart3, Building2, DatabaseBackup, FileText, Hash, LogOut, ReceiptText, ScrollText, Settings, UserRound } from "lucide-react";

const tabs = [
  ["dashboard", "Dashboard", BarChart3],
  ["invoice", "New Invoice", ReceiptText],
  ["invoices", "Invoices", FileText],
  ["quotations", "Quotations", ScrollText],
  ["customers", "Customers", Building2],
  ["hsn", "HSN/SAC", Hash],
  ["reports", "Reports", BarChart3],
  ["settings", "Settings", Settings],
  ["backup", "Backup", DatabaseBackup]
];

export function Layout({ activeTab, setActiveTab, settings, user, onLogout, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <span className={`brand-mark ${settings?.logoPath ? "has-logo" : ""}`}>
            <span id="brandFallback">EK</span>
            {settings?.logoPath && <img id="brandLogo" src={`${API_ORIGIN}${settings.logoPath}`} alt="Company logo" />}
          </span>
          <div><strong>EKOVITS</strong><span>CRM & GST Portal</span></div>
        </div>
        <nav className="tabs" aria-label="Primary">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {user && <div className="user-menu">
          <span className="user-avatar"><UserRound size={17} /></span>
          <div><strong>{user.email}</strong><span>{user.role}</span></div>
          <button className="logout-button" onClick={onLogout} aria-label="Logout"><LogOut size={17} /></button>
        </div>}
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div><h1>{pageTitle(activeTab)}</h1><p>{pageSubtitle(activeTab)}</p></div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function pageTitle(activeTab) {
  return tabs.find(([id]) => id === activeTab)?.[1] || "Portal";
}

function pageSubtitle(activeTab) {
  return ({
    dashboard: "Business overview and work queues",
    invoice: "Create and review invoices",
    invoices: "Manage invoice lifecycle and payments",
    quotations: "Create, send, and track quotations",
    customers: "CRM accounts and contact profiles",
    hsn: "GST service and HSN/SAC master",
    reports: "Accounting and GST summaries",
    settings: "Company profile and document assets",
    backup: "Export and restore tools"
  })[activeTab] || "";
}
