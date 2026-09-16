const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  if (options.raw) return response;
  const json = await response.json();
  return json.data;
}

export const api = {
  health: () => request("/health"),
  auth: {
    session: () => request("/auth/session"),
    login: data => request("/auth/login", { method: "POST", body: data }),
    logout: () => request("/auth/logout", { method: "POST" })
  },
  customers: {
    list: search => request(`/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: data => request("/customers", { method: "POST", body: data }),
    update: (id, data) => request(`/customers/${id}`, { method: "PUT", body: data }),
    remove: id => request(`/customers/${id}`, { method: "DELETE" })
  },
  hsn: {
    list: search => request(`/hsn${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: data => request("/hsn", { method: "POST", body: data }),
    update: (id, data) => request(`/hsn/${id}`, { method: "PUT", body: data }),
    remove: id => request(`/hsn/${id}`, { method: "DELETE" })
  },
  invoices: {
    list: search => request(`/invoices${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    reserveNumber: () => request("/invoices/next-number", { method: "POST" }),
    create: data => request("/invoices", { method: "POST", body: data }),
    update: (id, data) => request(`/invoices/${id}`, { method: "PUT", body: data }),
    remove: (id, reason) => request(`/invoices/${id}`, { method: "DELETE", body: { reason } }),
    duplicate: id => request(`/invoices/${id}/duplicate`, { method: "POST" }),
    cancel: (id, reason) => request(`/invoices/${id}/cancel`, { method: "POST", body: { reason } }),
    importTemplateUrl: `${API_URL}/invoices/import/template`,
    previewImport: form => request("/invoices/import/preview", { method: "POST", body: form }),
    commitImport: form => request("/invoices/import/commit", { method: "POST", body: form }),
    attachOriginal: (id, form) => request(`/invoices/${id}/original-document`, { method: "POST", body: form }),
    originalDocumentUrl: id => `${API_URL}/invoices/${id}/original-document`
  },
  quotations: {
    list: search => request(`/quotations${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    reserveNumber: () => request("/quotations/next-number", { method: "POST" }),
    create: data => request("/quotations", { method: "POST", body: data }),
    update: (id, data) => request(`/quotations/${id}`, { method: "PUT", body: data }),
    remove: (id, reason) => request(`/quotations/${id}`, { method: "DELETE", body: { reason } }),
    duplicate: id => request(`/quotations/${id}/duplicate`, { method: "POST" }),
    cancel: (id, reason) => request(`/quotations/${id}/cancel`, { method: "POST", body: { reason } })
  },
  payments: {
    list: () => request("/payments"),
    create: data => request("/payments", { method: "POST", body: data }),
    update: (id, data) => request(`/payments/${id}`, { method: "PUT", body: data }),
    remove: id => request(`/payments/${id}`, { method: "DELETE" })
  },
  settings: {
    get: () => request("/settings"),
    update: data => request("/settings", { method: "PUT", body: data }),
    assets: form => request("/settings/assets", { method: "POST", body: form })
  },
  reports: {
    dashboard: range => request(`/reports/dashboard?range=${range}`),
    gst: () => request("/reports/gst-summary"),
    hsn: () => request("/reports/hsn-summary"),
    customer: () => request("/reports/customer-summary"),
    monthly: () => request("/reports/monthly-summary")
  },
  audit: () => request("/audit"),
  backup: {
    json: () => request("/backup/json"),
    excelUrl: `${API_URL}/backup/excel`,
    restoreJson: data => request("/backup/restore-json", { method: "POST", body: data })
  }
};
