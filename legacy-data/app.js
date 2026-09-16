const DB_NAME = "ekovits_invoice_gst_manager";
const DB_VERSION = 1;
const stores = ["settings", "customers", "hsn", "invoices", "payments", "audit"];
let db, state = { settings: null, customers: [], hsn: [], invoices: [], payments: [], audit: [] };
let editingInvoiceId = null, currentRange = "month";
let liveExcelHandle = null, liveExcelSyncTimer = null;
let excelDatabaseDirectoryHandle = null, excelDatabaseSyncTimer = null;

const defaultSettings = {
  id: "company",
  name: "EKOVITS CONSULTING LLP",
  address: "A/307, Muktanand Nagar,\nHirawada Road,\nKannad, Aurangabad - 431103,\nMaharashtra, India",
  contact: "+91-7588800770 / +91-8421640770",
  email: "hello@ekovits.com",
  website: "www.ekovits.com",
  gstin: "27AAMFE2504P1Z4",
  state: "Maharashtra",
  stateCode: "27",
  bankName: "Maharashtra Gramin Bank",
  accountNo: "00100092889",
  ifsc: "MAHG0005133",
  branch: "Kannad, Chhatrapati Sambhajinagar (Aurangabad), 431101.",
  signatory: "Rohan Milind Sangwe",
  invoicePrefix: "",
  nextInvoiceNumber: 202621,
  logo: "",
  stamp: "",
  signature: ""
};

const sampleCustomer = {
  id: "cust_sample",
  name: "SHIKSHAK SAHAKARI BANK LTD",
  billingAddress: "Near Gandhi Sagar, Mahal, Nagpur, 440018.",
  shippingAddress: "",
  contactPerson: "",
  contactNumber: "",
  email: "",
  gstin: "",
  state: "Maharashtra",
  stateCode: "27",
  pan: "",
  type: "Business",
  notes: "Sample customer from reference invoice.",
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const sampleHsn = {
  id: "hsn_998713",
  code: "998713",
  description: "Outward CGST / Outward SGST",
  gstRate: 18,
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
  unit: "No.",
  active: true,
  notes: "Sample HSN/SAC from reference invoice.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  db = await openDb();
  await seedIfEmpty();
  await refresh();
  bindEvents();
  resetInvoiceForm();
  renderAll();
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      stores.forEach((s) => {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" });
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = "readonly") { return db.transaction(store, mode).objectStore(store); }
function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = tx(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function put(store, value) {
  return new Promise((resolve, reject) => {
    const req = tx(store, "readwrite").put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}
function del(store, id) {
  return new Promise((resolve, reject) => {
    const req = tx(store, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
function clearStore(store) {
  return new Promise((resolve, reject) => {
    const req = tx(store, "readwrite").clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function seedIfEmpty() {
  const settings = await getAll("settings");
  if (!settings.length) await put("settings", defaultSettings);
  const customers = await getAll("customers");
  if (!customers.length) await put("customers", sampleCustomer);
  const hsn = await getAll("hsn");
  if (!hsn.length) await put("hsn", sampleHsn);
}

async function refresh() {
  const [settings, customers, hsn, invoices, payments, audit] = await Promise.all(stores.map(getAll));
  state.settings = settings[0] || defaultSettings;
  if (state.settings.invoicePrefix === "BD" || Number(state.settings.nextInvoiceNumber) < 202621) {
    state.settings = { ...state.settings, invoicePrefix: "", nextInvoiceNumber: Math.max(Number(state.settings.nextInvoiceNumber) || 0, 202621) };
    await put("settings", state.settings);
  }
  state.customers = customers.sort((a, b) => a.name.localeCompare(b.name));
  state.hsn = hsn.sort((a, b) => a.code.localeCompare(b.code));
  state.invoices = invoices.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  state.payments = payments;
  state.audit = audit.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

function bindEvents() {
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  document.querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => { currentRange = b.dataset.range; document.querySelectorAll(".filters button").forEach(x => x.classList.toggle("active", x === b)); renderDashboard(); }));
  byId("addItemBtn").addEventListener("click", () => addItemRow());
  byId("invoiceForm").addEventListener("input", recalcInvoice);
  byId("invoiceForm").addEventListener("submit", (e) => { e.preventDefault(); saveInvoice("Final"); });
  byId("saveDraftBtn").addEventListener("click", () => saveInvoice("Draft"));
  byId("clearInvoiceBtn").addEventListener("click", resetInvoiceForm);
  byId("previewInvoiceBtn").addEventListener("click", previewCurrentInvoice);
  byId("customerSelect").addEventListener("change", fillCustomerFromSelect);
  byId("clientGstin").addEventListener("input", validateGstinHint);
  byId("newCustomerBtn").addEventListener("click", () => openCustomerModal());
  byId("addCustomerInlineBtn").addEventListener("click", () => openCustomerModal());
  byId("newHsnBtn").addEventListener("click", () => openHsnModal());
  byId("settingsForm").addEventListener("submit", saveSettings);
  byId("logoInput").addEventListener("change", (e) => readAsset(e, "logo"));
  byId("stampInput").addEventListener("change", (e) => readAsset(e, "stamp"));
  byId("signatureInput").addEventListener("change", (e) => readAsset(e, "signature"));
  byId("modalClose").addEventListener("click", closeModal);
  byId("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  byId("invoiceSearch").addEventListener("input", renderInvoiceList);
  byId("customerSearch").addEventListener("input", renderCustomers);
  byId("hsnSearch").addEventListener("input", renderHsn);
  byId("backupJsonBtn").addEventListener("click", backupJson);
  byId("syncExcelDbBtn").addEventListener("click", syncExcelDatabase);
  byId("exportExcelBtn").addEventListener("click", () => exportWorkbook("EKOVITS_INVOICE_DATABASE.xls"));
  byId("connectExcelBtn").addEventListener("click", connectLiveExcel);
  byId("exportCustomersBtn").addEventListener("click", () => exportCsv("Ekovits_Customers.csv", customerRows()));
  byId("exportHsnBtn").addEventListener("click", () => exportCsv("Ekovits_HSN_SAC_Master.csv", hsnRows()));
  byId("exportReportsBtn").addEventListener("click", () => exportWorkbook("EKOVITS_REPORTS.xls", true));
  byId("restoreInput").addEventListener("change", restoreBackup);
  byId("resetSampleBtn").addEventListener("click", restoreSampleData);
}

function showTab(id) {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
  renderAll();
}

function renderAll() {
  renderSettings();
  renderCustomerOptions();
  renderDashboard();
  renderInvoiceList();
  renderCustomers();
  renderHsn();
  renderPayments();
  renderReports();
  renderAudit();
}

function resetInvoiceForm() {
  editingInvoiceId = null;
  byId("invoiceFormTitle").textContent = "New Invoice";
  byId("editNotice").classList.add("hidden");
  byId("revisionBox").classList.add("hidden");
  byId("editReason").value = "";
  byId("invoiceForm").reset();
  byId("invoiceDate").valueAsDate = new Date();
  byId("clientState").value = state.settings?.state || "Maharashtra";
  byId("clientStateCode").value = state.settings?.stateCode || "27";
  byId("paymentTerms").value = "Due on receipt";
  byId("placeOfSupply").value = state.settings?.state || "Maharashtra";
  byId("invoiceNo").value = nextInvoiceNo();
  byId("itemsBody").innerHTML = "";
  recalcInvoice();
}

function addItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <span class="sr"></span>
    <textarea class="desc" placeholder="Description">${escapeHtml(item.description || "")}</textarea>
    <input class="hsn" list="hsnCodes" value="${escapeAttr(item.hsn || "")}" placeholder="HSN/SAC">
    <input class="gst" type="number" step="0.01" value="${item.gstRate ?? 18}">
    <input class="qty" type="number" step="0.01" value="${item.qty ?? 1}">
    <input class="rate" type="number" step="0.01" value="${item.rate ?? 0}">
    <span class="taxable">₹0.00</span>
    <button type="button" class="danger small remove">×</button>`;
  row.querySelector(".remove").addEventListener("click", () => { row.remove(); renumberItems(); recalcInvoice(); });
  row.querySelector(".hsn").addEventListener("change", () => {
    const h = state.hsn.find(x => x.code === row.querySelector(".hsn").value);
    if (h) {
      row.querySelector(".desc").value = h.description;
      row.querySelector(".gst").value = h.gstRate;
    }
    recalcInvoice();
  });
  byId("itemsBody").append(row);
  ensureDatalist();
  renumberItems();
  recalcInvoice();
}

function ensureDatalist() {
  let list = byId("hsnCodes");
  if (!list) {
    list = document.createElement("datalist");
    list.id = "hsnCodes";
    document.body.append(list);
  }
  list.innerHTML = state.hsn.map(h => `<option value="${escapeAttr(h.code)}">${escapeHtml(h.description)} - ${h.gstRate}%</option>`).join("");
}

function renumberItems() {
  [...document.querySelectorAll(".item-row")].forEach((r, i) => r.querySelector(".sr").textContent = i + 1);
}

function collectInvoice(status = "Draft") {
  const items = [...document.querySelectorAll(".item-row")].map((r, i) => {
    const qty = Number(r.querySelector(".qty").value || 0);
    const rate = Number(r.querySelector(".rate").value || 0);
    const gstRate = Number(r.querySelector(".gst").value || 0);
    const taxableCents = moneyCents(qty * rate);
    return {
      id: uid("item"),
      srNo: i + 1,
      description: r.querySelector(".desc").value.trim(),
      hsn: r.querySelector(".hsn").value.trim(),
      gstRate,
      qty,
      rate,
      taxableCents
    };
  });
  const customerState = byId("clientState").value.trim();
  const gstType = resolvedGstType(customerState, byId("gstType").value);
  const totals = calculateTotals(items, gstType);
  const now = new Date().toISOString();
  const existing = state.invoices.find(i => i.id === editingInvoiceId);
  return {
    id: editingInvoiceId || uid("inv"),
    invoiceNo: byId("invoiceNo").value.trim(),
    invoiceDate: byId("invoiceDate").value,
    dueDate: byId("dueDate").value,
    placeOfSupply: byId("placeOfSupply").value.trim(),
    reverseCharge: byId("reverseCharge").value,
    gstType,
    gstOverride: byId("gstType").value !== "auto",
    paymentTerms: byId("paymentTerms").value.trim(),
    referenceNo: byId("referenceNo").value.trim(),
    customerId: byId("customerSelect").value,
    clientName: byId("clientName").value.trim(),
    clientAddress: byId("clientAddress").value.trim(),
    shippingAddress: byId("shippingAddress").value.trim(),
    contactPerson: byId("contactPerson").value.trim(),
    clientContact: byId("clientContact").value.trim(),
    clientEmail: byId("clientEmail").value.trim(),
    clientGstin: byId("clientGstin").value.trim().toUpperCase(),
    clientState: customerState,
    clientStateCode: byId("clientStateCode").value.trim(),
    notes: byId("notes").value.trim(),
    items,
    totals,
    invoiceStatus: status,
    paymentStatus: existing?.paymentStatus || "Unpaid",
    amountPaidCents: existing?.amountPaidCents || 0,
    companySnapshot: existing?.companySnapshot || structuredClone(state.settings),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    revision: (existing?.revision || 0) + (existing ? 1 : 0),
    cancellationReason: existing?.cancellationReason || ""
  };
}

function calculateTotals(items, gstType) {
  let taxableCents = 0, cgstCents = 0, sgstCents = 0, igstCents = 0;
  const gstBreakdown = buildGstBreakdown(items, gstType);
  gstBreakdown.forEach((group) => {
    taxableCents += group.taxableCents;
    cgstCents += group.cgstCents;
    sgstCents += group.sgstCents;
    igstCents += group.igstCents;
  });
  const totalGstCents = cgstCents + sgstCents + igstCents;
  const exactGrand = taxableCents + totalGstCents;
  const roundedGrandCents = Math.round(exactGrand / 100) * 100;
  return { taxableCents, cgstCents, sgstCents, igstCents, totalGstCents, gstBreakdown, roundOffCents: roundedGrandCents - exactGrand, grandTotalCents: roundedGrandCents };
}

function buildGstBreakdown(items, gstType) {
  const groups = new Map();
  items.forEach((it) => {
    const key = `${it.hsn || "Unspecified"}|${Number(it.gstRate || 0)}`;
    const group = groups.get(key) || { hsn: it.hsn || "Unspecified", gstRate: Number(it.gstRate || 0), taxableCents: 0, cgstCents: 0, sgstCents: 0, igstCents: 0 };
    group.taxableCents += Number(it.taxableCents || 0);
    if (gstType === "intra") {
      group.cgstCents += Math.round(Number(it.taxableCents || 0) * group.gstRate / 2 / 100);
      group.sgstCents += Math.round(Number(it.taxableCents || 0) * group.gstRate / 2 / 100);
    } else {
      group.igstCents += Math.round(Number(it.taxableCents || 0) * group.gstRate / 100);
    }
    groups.set(key, group);
  });
  return [...groups.values()];
}

function recalcInvoice() {
  const rows = [...document.querySelectorAll(".item-row")];
  rows.forEach((r) => {
    const qty = Number(r.querySelector(".qty").value || 0);
    const rate = Number(r.querySelector(".rate").value || 0);
    r.querySelector(".taxable").textContent = inr(moneyCents(qty * rate));
  });
  const inv = collectInvoice("Draft");
  byId("totalTaxable").textContent = inr(inv.totals.taxableCents);
  byId("totalCgst").textContent = inr(inv.totals.cgstCents);
  byId("totalSgst").textContent = inr(inv.totals.sgstCents);
  byId("totalIgst").textContent = inr(inv.totals.igstCents);
  byId("totalGst").textContent = inr(inv.totals.totalGstCents);
  byId("roundOff").textContent = signedInr(inv.totals.roundOffCents);
  byId("grandTotal").textContent = inr(inv.totals.grandTotalCents);
  byId("amountWords").textContent = "Indian Rupees " + amountInWords(inv.totals.grandTotalCents);
}

async function saveInvoice(status) {
  const inv = collectInvoice(status);
  const validation = validateInvoice(inv);
  if (validation) return toast(validation, "err");
  const existing = state.invoices.find(i => i.id === inv.id);
  if (!existing && state.invoices.some(i => i.invoiceNo === inv.invoiceNo)) return toast("Invoice number already exists.", "err");
  if (inv.gstOverride && !confirm("GST treatment was manually overridden. Save anyway?")) return;
  if (existing && existing.invoiceStatus === "Final") {
    const reason = byId("editReason").value.trim();
    if (!reason) return toast("Please enter the edit reason.", "err");
    await audit("Invoice Edited", inv.invoiceNo, summarizeInvoice(existing), summarizeInvoice(inv), reason);
  } else {
    await audit(existing ? "Draft Updated" : "Invoice Created", inv.invoiceNo, "", summarizeInvoice(inv), "");
  }
  await put("invoices", inv);
  if (!existing) await reserveInvoiceNumber(inv.invoiceNo);
  await refresh();
  renderAll();
  scheduleLiveExcelSync();
  resetInvoiceForm();
  showTab("invoices");
  toast(status === "Final" ? "Final invoice saved." : "Draft invoice saved.");
}

function validateInvoice(inv) {
  if (!inv.invoiceNo) return "Invoice number is required.";
  if (!inv.invoiceDate) return "Invoice date is required.";
  if (!inv.clientName || !inv.clientAddress) return "Client name and address are required.";
  if (inv.clientGstin && !validGstin(inv.clientGstin)) return "Invalid GSTIN format.";
  if (!inv.items.length) return "Please add at least one invoice item.";
  if (inv.items.some(i => !i.description || !i.hsn || i.qty <= 0 || i.rate < 0)) return "Every line needs description, HSN/SAC, quantity, and rate.";
  if (inv.totals.grandTotalCents <= 0) return "Invoice total must be greater than zero.";
  return "";
}

async function reserveInvoiceNumber(no) {
  const s = { ...state.settings };
  const numeric = Number(String(no).replace(s.invoicePrefix || "", ""));
  if (Number.isFinite(numeric) && numeric >= Number(s.nextInvoiceNumber)) {
    s.nextInvoiceNumber = numeric + 1;
    await put("settings", s);
  }
}

function nextInvoiceNo() {
  const s = state.settings || defaultSettings;
  let n = Number(s.nextInvoiceNumber || 1);
  const used = new Set(state.invoices.map(i => i.invoiceNo));
  let no = `${n}`;
  while (used.has(no)) no = `${++n}`;
  return no;
}

function editInvoice(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;
  editingInvoiceId = id;
  showTab("invoice");
  byId("invoiceFormTitle").textContent = `Edit Invoice ${inv.invoiceNo}`;
  byId("editNotice").textContent = inv.invoiceStatus === "Final" ? "Final invoice correction mode: changes will update the saved invoice and create an audit log entry." : "Draft edit mode.";
  byId("editNotice").classList.remove("hidden");
  byId("revisionBox").classList.toggle("hidden", inv.invoiceStatus !== "Final");
  setVal("invoiceNo", inv.invoiceNo); setVal("invoiceDate", inv.invoiceDate); setVal("dueDate", inv.dueDate);
  setVal("placeOfSupply", inv.placeOfSupply); setVal("gstType", inv.gstType); setVal("reverseCharge", inv.reverseCharge);
  setVal("paymentTerms", inv.paymentTerms); setVal("referenceNo", inv.referenceNo); setVal("customerSelect", inv.customerId);
  setVal("clientName", inv.clientName); setVal("clientAddress", inv.clientAddress); setVal("shippingAddress", inv.shippingAddress);
  setVal("contactPerson", inv.contactPerson); setVal("clientContact", inv.clientContact); setVal("clientEmail", inv.clientEmail);
  setVal("clientGstin", inv.clientGstin); setVal("clientState", inv.clientState); setVal("clientStateCode", inv.clientStateCode); setVal("notes", inv.notes);
  byId("itemsBody").innerHTML = "";
  inv.items.forEach(addItemRow);
  recalcInvoice();
}

async function duplicateInvoice(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;
  editingInvoiceId = null;
  editInvoice(id);
  editingInvoiceId = null;
  byId("invoiceFormTitle").textContent = `Duplicate Invoice ${inv.invoiceNo}`;
  byId("invoiceNo").value = nextInvoiceNo();
  byId("invoiceDate").valueAsDate = new Date();
  byId("revisionBox").classList.add("hidden");
  toast("Invoice duplicated into a new draft form.");
}

async function cancelInvoice(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv || inv.invoiceStatus === "Cancelled") return;
  const reason = prompt("Cancellation reason is required:");
  if (!reason) return;
  if (!confirm(`Cancel invoice ${inv.invoiceNo}? It will remain in history and the number will not be reused.`)) return;
  const updated = { ...inv, invoiceStatus: "Cancelled", paymentStatus: "Unpaid", cancellationReason: reason, updatedAt: new Date().toISOString() };
  await put("invoices", updated);
  await audit("Invoice Cancelled", inv.invoiceNo, inv.invoiceStatus, "Cancelled", reason);
  await refresh(); renderAll(); scheduleLiveExcelSync(); toast("Invoice cancelled.");
}

async function deleteInvoice(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv) return;
  const reason = prompt(`Reason for deleting invoice ${inv.invoiceNo}:`);
  if (!reason) return;
  if (!confirm(`Permanently delete invoice ${inv.invoiceNo}? The invoice number will stay reserved because the counter will not be rolled back.`)) return;
  await audit("Invoice Deleted", inv.invoiceNo, summarizeInvoice(inv), "Deleted from invoice history", reason);
  await del("invoices", id);
  await refresh();
  renderAll();
  scheduleLiveExcelSync();
  toast("Invoice deleted.");
}

function previewCurrentInvoice() {
  const inv = collectInvoice("Draft");
  if (validateInvoice(inv)) return toast(validateInvoice(inv), "err");
  openPreview(inv);
}

function openPreview(inv) {
  byId("modalBody").innerHTML = `<div class="preview-actions"><button class="secondary" id="printBtn">Print / Save PDF</button><button class="primary" id="downloadPdfBtn">Download PDF</button></div><div class="invoice-wrap">${buildInvoiceHtml(inv)}</div>`;
  byId("modal").classList.remove("hidden");
  byId("printBtn").onclick = () => printInvoice(inv);
  byId("downloadPdfBtn").onclick = () => printInvoice(inv, true);
}

function printInvoice(inv, pdfHint = false) {
  byId("printRoot").innerHTML = buildInvoiceHtml(inv);
  const originalTitle = document.title;
  document.title = `TAX INVOICE- ${inv.invoiceNo}`;
  if (pdfHint) toast(`Save as TAX INVOICE- ${inv.invoiceNo}.pdf. Keep browser headers and footers off.`);
  setTimeout(() => {
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 500);
  }, 80);
}

function buildInvoiceHtml(inv) {
  const s = inv.companySnapshot || state.settings;
  const t = inv.totals;
  const breakdown = t.gstBreakdown || buildGstBreakdown(inv.items, inv.gstType);
  const gstRows = breakdown.map((g) => inv.gstType === "intra"
    ? `<tr><td class="center small-text">${escapeHtml(g.hsn)}</td><td class="right small-text">${money(g.taxableCents)}</td><td class="center small-text">${(g.gstRate / 2).toFixed(g.gstRate % 2 ? 2 : 0)}%</td><td class="right small-text">${money(g.cgstCents)}</td><td class="center small-text">${(g.gstRate / 2).toFixed(g.gstRate % 2 ? 2 : 0)}%</td><td class="right small-text">${money(g.sgstCents)}</td><td class="right small-text">${money(g.cgstCents + g.sgstCents)}</td></tr>`
    : `<tr><td class="center small-text">${escapeHtml(g.hsn)}</td><td class="right small-text">${money(g.taxableCents)}</td><td colspan="2" class="center small-text">-</td><td class="center small-text">${g.gstRate}%</td><td class="right small-text">${money(g.igstCents)}</td><td class="right small-text">${money(g.igstCents)}</td></tr>`).join("");
  return `<div class="invoice-doc invoice-wrap">${inv.invoiceStatus === "Cancelled" ? '<div class="cancel-watermark">CANCELLED</div>' : ""}
    <table class="tax-invoice">
      <tr>
        <td colspan="7" class="top-left">
          <div class="header-right">
            <div class="title">TAX INVOICE</div>
            <div class="invno">${escapeHtml(inv.invoiceNo)}</div>
          </div>
          ${s.logo ? `<img class="logo" src="${s.logo}" alt="Logo">` : '<div class="fallback-logo">EKOVITS</div>'}
          <div class="company">${escapeHtml(s.name)}</div>
          <div class="company-meta">
            <div><b>Address:</b> ${formatCompanyAddress(s.address)}</div>
            <div><b>Contact:</b> ${escapeHtml(s.contact)}</div>
            <div><b>Email ID:</b> ${escapeHtml(s.email)} <b>Website:</b> ${escapeHtml(s.website)}</div>
            <div class="meta-gap"><b>GSTIN:</b> ${escapeHtml(s.gstin)}</div>
            <div><b>STATE:</b> ${escapeHtml(s.state)}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td colspan="5" class="to-cell small-text"><b>TO: ${escapeHtml(inv.clientName).toUpperCase()}</b><br><b>Address:</b> ${nl(inv.clientAddress)}<br><b>State:</b> ${escapeHtml(inv.clientState)} ${inv.clientGstin ? `<br><b>GSTIN:</b> ${escapeHtml(inv.clientGstin)}` : ""}</td>
        <td colspan="2" class="date-cell">Date: ${formatDate(inv.invoiceDate)}</td>
      </tr>
      <tr><th>SR. NO</th><th>DESCRIPTION</th><th>HSN / SAC</th><th>GST%</th><th>QTY</th><th>RATE</th><th>Amount</th></tr>
      ${inv.items.map((it, i) => `<tr class="item-space"><td class="center">${i + 1}</td><td class="center">${nl(it.description)}</td><td class="center">${escapeHtml(it.hsn)}</td><td class="center">${it.gstRate}%</td><td class="center">${it.qty}</td><td class="right">${money(moneyCents(it.rate))}</td><td class="right">${money(it.taxableCents)}</td></tr>`).join("")}
      <tr><td colspan="4"></td><td class="center bold">${sumQty(inv)} No.</td><td></td><td class="right bold">₹ ${money(t.grandTotalCents)}</td></tr>
      <tr class="words-row"><td colspan="7" class="small-text">Amount Chargeable (in words)<br><b>Indian Rupees ${amountInWords(t.grandTotalCents)}</b></td></tr>
      <tr><th>HSN/SAC</th><th>Taxable<br>Value</th><th colspan="2">CGST</th><th colspan="2">SGST/UTGST</th><th>Total<br>Tax Amount</th></tr>
      <tr><th></th><th></th><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th><th></th></tr>
      ${gstRows}
      <tr><td class="center bold small-text">Total</td><td class="right bold small-text">${money(t.taxableCents)}</td><td></td><td class="right bold small-text">${money(t.cgstCents)}</td><td></td><td class="right bold small-text">${money(t.sgstCents + t.igstCents)}</td><td class="right bold small-text">${money(t.totalGstCents)}</td></tr>
      <tr><td class="small-text">Tax Amount (in words)<br>:</td><td colspan="6" class="small-text"><b>Indian Rupees ${amountInWords(t.totalGstCents)}</b></td></tr>
      <tr>
        <td colspan="2" class="notes-cell">
          ${inv.referenceNo ? `<div><b>Reference / PO:</b> ${escapeHtml(inv.referenceNo)}</div>` : ""}
          ${inv.notes ? `<div class="terms-heading"><b>Terms &amp; Conditions / Notes</b></div><div>${nl(inv.notes)}</div>` : `<div class="terms-heading"><b>Terms &amp; Conditions / Notes</b></div>`}
        </td>
        <td colspan="5" class="tiny">
          <table class="tax-invoice">
            <tr><td colspan="2" class="bold">Company's Bank Details</td></tr>
            <tr><td class="bank-label">A/c Name :</td><td>${escapeHtml(s.name)}</td></tr>
            <tr><td class="bank-label">Bank Name:</td><td>${escapeHtml(s.bankName)}</td></tr>
            <tr><td class="bank-label">A/C No:</td><td>${escapeHtml(s.accountNo)}</td></tr>
            <tr><td class="bank-label">IFSC Code:</td><td>${escapeHtml(s.ifsc)}</td></tr>
            <tr><td class="bank-label">Branch</td><td>${escapeHtml(s.branch)}</td></tr>
            <tr><td colspan="2" class="right bold">for ${escapeHtml(s.name)}</td></tr>
            <tr><td class="center">${s.stamp ? `<img class="stamp-img" src="${s.stamp}" alt="Stamp">` : ""}</td><td class="right">${s.signature ? `<img class="sign-img" src="${s.signature}" alt="Signature">` : ""}<br>${escapeHtml(s.signatory)}<br><b>Authorised Signatory</b></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function renderDashboard() {
  const inv = filteredInvoices().filter(i => i.invoiceStatus !== "Cancelled");
  const cancelled = filteredInvoices().filter(i => i.invoiceStatus === "Cancelled").length;
  const taxable = sum(inv, i => i.totals.taxableCents), gst = sum(inv, i => i.totals.totalGstCents), total = sum(inv, i => i.totals.grandTotalCents), paid = sum(inv, i => i.amountPaidCents || 0);
  const cards = [
    ["Total Invoices", inv.length + cancelled], ["Taxable Value", inr(taxable)], ["Total GST", inr(gst)], ["Invoice Value", inr(total)], ["Outstanding", inr(total - paid)],
    ["Paid", state.invoices.filter(i => i.paymentStatus === "Paid").length], ["Unpaid", state.invoices.filter(i => i.paymentStatus === "Unpaid").length], ["Partially Paid", state.invoices.filter(i => i.paymentStatus === "Partially Paid").length], ["Cancelled", cancelled], ["Amount Received", inr(paid)]
  ];
  byId("dashboardCards").innerHTML = cards.map(c => `<div class="metric"><span>${c[0]}</span><strong>${c[1]}</strong></div>`).join("");
  byId("recentInvoices").innerHTML = state.invoices.slice(0, 5).map(i => `${i.invoiceNo} - ${escapeHtml(i.clientName)} - ${inr(i.totals.grandTotalCents)} <span class="badge ${badgeClass(i)}">${i.invoiceStatus}</span>`).join("<br>") || "No invoices yet.";
}

function renderInvoiceList() {
  const q = byId("invoiceSearch").value?.toLowerCase() || "";
  const rows = state.invoices.filter(i => JSON.stringify([i.invoiceNo, i.clientName, i.clientGstin, i.invoiceDate, money(i.totals.grandTotalCents), i.paymentStatus, i.invoiceStatus]).toLowerCase().includes(q));
  byId("invoiceList").innerHTML = rows.map(i => `<div class="record ${i.invoiceStatus.toLowerCase()}"><div><div class="record-title">${escapeHtml(i.invoiceNo)}</div><small>${formatDate(i.invoiceDate)} · ${escapeHtml(i.invoiceStatus)}</small></div><div>${escapeHtml(i.clientName)}<small>${escapeHtml(i.clientGstin || i.clientState || "")}</small></div><div><strong>${inr(i.totals.grandTotalCents)}</strong><br><span class="badge ${badgeClass(i)}">${i.paymentStatus}</span></div><div class="record-actions"><button class="secondary small" onclick="viewInvoice('${i.id}')">View</button><button class="secondary small" onclick="editInvoice('${i.id}')">Edit</button><button class="secondary small" onclick="duplicateInvoice('${i.id}')">Duplicate</button><button class="secondary small" onclick="openPaymentModal('${i.id}')">Payment</button><button class="secondary small" onclick="printSavedInvoice('${i.id}')">PDF/Print</button><button class="danger small" onclick="cancelInvoice('${i.id}')">Cancel</button><button class="danger small" onclick="deleteInvoice('${i.id}')">Delete</button></div></div>`).join("") || "<div class='panel'>No invoices found.</div>";
}

function renderCustomers() {
  const q = byId("customerSearch").value?.toLowerCase() || "";
  const rows = state.customers.filter(c => JSON.stringify(c).toLowerCase().includes(q));
  byId("customerList").innerHTML = table(["Name", "GSTIN", "Contact", "State", "Status", "Actions"], rows.map(c => [c.name, c.gstin || "", c.contactNumber || "", c.state || "", c.active ? "Active" : "Inactive", `<button class="secondary small" onclick="openCustomerModal('${c.id}')">Edit</button> <button class="danger small" onclick="deactivateCustomer('${c.id}')">Deactivate</button>`]));
}

function renderHsn() {
  const q = byId("hsnSearch").value?.toLowerCase() || "";
  const rows = state.hsn.filter(h => JSON.stringify(h).toLowerCase().includes(q));
  byId("hsnList").innerHTML = table(["Code", "Description", "GST", "CGST", "SGST", "IGST", "Status", "Actions"], rows.map(h => [h.code, h.description, h.gstRate + "%", h.cgstRate + "%", h.sgstRate + "%", h.igstRate + "%", h.active ? "Active" : "Inactive", `<button class="secondary small" onclick="openHsnModal('${h.id}')">Edit</button> <button class="danger small" onclick="deactivateHsn('${h.id}')">Deactivate</button>`]));
}

function renderPayments() {
  const rows = state.invoices.map(i => [i.invoiceNo, i.clientName, inr(i.totals.grandTotalCents), inr(i.amountPaidCents || 0), inr(i.totals.grandTotalCents - (i.amountPaidCents || 0)), i.paymentStatus, `<button class="secondary small" onclick="openPaymentModal('${i.id}')">Update</button>`]);
  byId("paymentsList").innerHTML = table(["Invoice", "Client", "Total", "Paid", "Balance", "Status", "Action"], rows);
}

function renderReports() {
  const active = state.invoices.filter(i => i.invoiceStatus !== "Cancelled");
  const gst = [["Taxable", inr(sum(active, i => i.totals.taxableCents))], ["CGST", inr(sum(active, i => i.totals.cgstCents))], ["SGST", inr(sum(active, i => i.totals.sgstCents))], ["IGST", inr(sum(active, i => i.totals.igstCents))], ["Total GST", inr(sum(active, i => i.totals.totalGstCents))], ["Invoice Value", inr(sum(active, i => i.totals.grandTotalCents))]];
  byId("gstSummary").innerHTML = table(["Metric", "Value"], gst);
  byId("hsnSummary").innerHTML = table(["HSN/SAC", "Taxable", "GST", "Invoice Value"], groupByItems(active));
  byId("customerSummary").innerHTML = table(["Customer", "Invoices", "Taxable", "Invoice Value"], groupBy(active, i => i.clientName));
  byId("monthlySummary").innerHTML = table(["Month", "Invoices", "Taxable", "Invoice Value"], groupBy(active, i => (i.invoiceDate || "").slice(0, 7)));
}

function renderAudit() {
  byId("auditLog").innerHTML = table(["Date/Time", "Action", "Invoice", "Reason"], state.audit.map(a => [formatDateTime(a.at), a.action, a.invoiceNo || "", a.reason || ""]));
}

function renderCustomerOptions() {
  byId("customerSelect").innerHTML = `<option value="">Select customer</option>` + state.customers.filter(c => c.active).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function renderSettings() {
  const form = byId("settingsForm");
  Object.keys(state.settings).forEach(k => { if (form.elements[k]) form.elements[k].value = state.settings[k] ?? ""; });
  const logo = byId("brandLogo"), mark = document.querySelector(".brand-mark");
  if (logo && mark) { logo.src = state.settings.logo || ""; mark.classList.toggle("has-logo", Boolean(state.settings.logo)); }
}

function openCustomerModal(id) {
  const c = state.customers.find(x => x.id === id) || {};
  byId("modalBody").innerHTML = byId("customerFormTemplate").innerHTML;
  const f = byId("customerForm");
  Object.keys(c).forEach(k => { if (f.elements[k]) f.elements[k].value = c[k]; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f).entries());
    if (data.gstin && !validGstin(data.gstin)) return toast("Invalid GSTIN format.", "err");
    const now = new Date().toISOString();
    const rec = { ...c, ...data, gstin: (data.gstin || "").toUpperCase(), active: data.active === "true", id: id || uid("cust"), createdAt: c.createdAt || now, updatedAt: now };
    await put("customers", rec); await audit(id ? "Customer Updated" : "Customer Added", "", c.name || "", rec.name, "");
    scheduleLiveExcelSync();
    await refresh(); renderAll(); closeModal(); toast("Customer saved.");
  };
  byId("modal").classList.remove("hidden");
}

function openHsnModal(id) {
  const h = state.hsn.find(x => x.id === id) || {};
  byId("modalBody").innerHTML = byId("hsnFormTemplate").innerHTML;
  const f = byId("hsnForm");
  Object.keys(h).forEach(k => { if (f.elements[k]) f.elements[k].value = h[k]; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f).entries());
    const now = new Date().toISOString();
    const rec = { ...h, ...data, id: id || uid("hsn"), gstRate: Number(data.gstRate), cgstRate: Number(data.cgstRate), sgstRate: Number(data.sgstRate), igstRate: Number(data.igstRate), active: data.active === "true", createdAt: h.createdAt || now, updatedAt: now };
    await put("hsn", rec); await audit(id ? "HSN Updated" : "HSN Added", "", h.code || "", rec.code, "");
    scheduleLiveExcelSync();
    await refresh(); renderAll(); closeModal(); toast("HSN/SAC saved.");
  };
  byId("modal").classList.remove("hidden");
}

function openPaymentModal(id) {
  const inv = state.invoices.find(i => i.id === id);
  if (!inv || inv.invoiceStatus === "Cancelled") return toast("Cancelled invoices cannot be marked paid.", "err");
  byId("modalBody").innerHTML = byId("paymentFormTemplate").innerHTML;
  const f = byId("paymentForm");
  f.elements.paymentStatus.value = inv.paymentStatus || "Unpaid";
  f.elements.amountPaid.value = ((inv.amountPaidCents || 0) / 100).toFixed(2);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f).entries());
    const paidCents = moneyCents(Number(data.amountPaid || 0));
    if (paidCents > inv.totals.grandTotalCents && !confirm("Amount paid exceeds invoice total. Save anyway?")) return;
    let status = data.paymentStatus;
    if (paidCents <= 0) status = "Unpaid";
    else if (paidCents < inv.totals.grandTotalCents) status = "Partially Paid";
    else status = "Paid";
    const updated = { ...inv, ...data, amountPaidCents: paidCents, paymentStatus: status, updatedAt: new Date().toISOString() };
    await put("invoices", updated);
    await put("payments", { id: uid("pay"), invoiceId: inv.id, invoiceNo: inv.invoiceNo, ...data, amountPaidCents: paidCents, paymentStatus: status, at: new Date().toISOString() });
    await audit("Payment Updated", inv.invoiceNo, inv.paymentStatus, status, data.paymentNotes || "");
    await refresh(); renderAll(); scheduleLiveExcelSync(); closeModal(); toast("Payment updated.");
  };
  byId("modal").classList.remove("hidden");
}

async function saveSettings(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  const rec = { ...state.settings, ...data, id: "company", invoicePrefix: "", nextInvoiceNumber: Number(data.nextInvoiceNumber || state.settings.nextInvoiceNumber) };
  if (rec.gstin && !validGstin(rec.gstin)) return toast("Invalid company GSTIN format.", "err");
  await put("settings", rec); await audit("Company Settings Updated", "", "", "Settings saved", "");
  scheduleLiveExcelSync();
  await refresh(); renderAll(); resetInvoiceForm(); toast("Settings saved.");
}

function readAsset(e, key) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => { await put("settings", { ...state.settings, [key]: reader.result }); await refresh(); renderAll(); scheduleLiveExcelSync(); toast(`${key} saved.`); };
  reader.readAsDataURL(file);
}

function fillCustomerFromSelect() {
  const c = state.customers.find(x => x.id === byId("customerSelect").value);
  if (!c) return;
  setVal("clientName", c.name); setVal("clientAddress", c.billingAddress); setVal("shippingAddress", c.shippingAddress);
  setVal("contactPerson", c.contactPerson); setVal("clientContact", c.contactNumber); setVal("clientEmail", c.email);
  setVal("clientGstin", c.gstin); setVal("clientState", c.state); setVal("clientStateCode", c.stateCode);
  validateGstinHint(); recalcInvoice();
}

function validateGstinHint() {
  const v = byId("clientGstin").value.trim();
  byId("gstinHint").textContent = !v ? "GSTIN format validation only. It does not verify GST registration online." : validGstin(v) ? "Valid GSTIN format. Registration is not verified online." : "Invalid GSTIN format.";
}

async function deactivateCustomer(id) {
  const c = state.customers.find(x => x.id === id); if (!c) return;
  if (!confirm(`Deactivate ${c.name}? Existing invoices remain unchanged.`)) return;
  await put("customers", { ...c, active: false, updatedAt: new Date().toISOString() }); await refresh(); renderAll(); scheduleLiveExcelSync();
}
async function deactivateHsn(id) {
  const h = state.hsn.find(x => x.id === id); if (!h) return;
  await put("hsn", { ...h, active: false, updatedAt: new Date().toISOString() }); await refresh(); renderAll(); scheduleLiveExcelSync();
}

function viewInvoice(id) { const inv = state.invoices.find(i => i.id === id); if (inv) openPreview(inv); }
function printSavedInvoice(id) { const inv = state.invoices.find(i => i.id === id); if (inv) printInvoice(inv, true); }
function closeModal() { byId("modal").classList.add("hidden"); byId("modalBody").innerHTML = ""; }

function backupJson() {
  download("EKOVITS_INVOICE_DATABASE_BACKUP.json", JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2), "application/json");
}

async function restoreBackup(e) {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(text);
    if (!confirm("Restore backup? This replaces current local app data.")) return;
    for (const s of stores) await clearStore(s);
    for (const s of stores) {
      const rows = Array.isArray(data[s]) ? data[s] : s === "settings" ? [data.settings] : [];
      for (const row of rows.filter(Boolean)) await put(s, row);
    }
    await refresh(); renderAll(); scheduleLiveExcelSync(); resetInvoiceForm(); toast("Backup restored.");
  } else {
    toast("This app imports full data from JSON backups. App-generated Excel files are review/export files.", "err");
  }
}

function exportWorkbook(name, reportsOnly = false) {
  const sheets = reportsOnly ? reportSheets() : allSheets();
  const html = `<html><head><meta charset="utf-8"></head><body>${sheets.map(s => `<h1>${escapeHtml(s.name)}</h1>${table(s.headers, s.rows)}`).join("")}</body></html>`;
  download(name, html, "application/vnd.ms-excel");
}

async function connectLiveExcel() {
  if (!window.showSaveFilePicker) {
    exportWorkbook("EKOVITS_INVOICE_DATABASE.xls");
    return toast("This browser cannot keep a live file handle. An Excel-compatible file was downloaded instead.", "err");
  }
  try {
    liveExcelHandle = await window.showSaveFilePicker({
      suggestedName: "EKOVITS_INVOICE_DATABASE.xls",
      types: [{ description: "Excel workbook", accept: { "application/vnd.ms-excel": [".xls"] } }]
    });
    await writeLiveExcel();
    toast("Live Excel file connected.");
  } catch (err) {
    if (err?.name !== "AbortError") toast("Could not connect the Excel file.", "err");
  }
}

function scheduleLiveExcelSync() {
  if (liveExcelHandle) {
    clearTimeout(liveExcelSyncTimer);
    liveExcelSyncTimer = setTimeout(() => writeLiveExcel().catch(() => {
      setExcelSyncStatus("Legacy Excel sync paused. Reconnect the file.", true);
      liveExcelHandle = null;
    }), 450);
  }
  scheduleExcelDatabaseSync();
}

async function writeLiveExcel() {
  if (!liveExcelHandle) return;
  const sheets = allSheets();
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial}table{border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #bbb;padding:5px 8px}th{background:#eee}</style></head><body>${sheets.map(s => `<h1>${escapeHtml(s.name)}</h1>${table(s.headers, s.rows)}`).join("")}</body></html>`;
  const writable = await liveExcelHandle.createWritable();
  await writable.write(html);
  await writable.close();
  setExcelSyncStatus(`Live Excel synced ${new Date().toLocaleTimeString()}.`);
}

async function syncExcelDatabase() {
  if (!window.showDirectoryPicker) {
    await downloadDatabaseXlsx();
    return toast("This browser cannot connect a folder. A complete XLSX database was downloaded instead.", "err");
  }
  try {
    excelDatabaseDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    await writeExcelDatabaseFiles();
    toast("Excel database connected and synced.");
  } catch (err) {
    if (err?.name !== "AbortError") {
      await downloadDatabaseXlsx();
      toast("Folder sync was unavailable, so a complete XLSX database was downloaded instead.", "err");
    }
  }
}

function scheduleExcelDatabaseSync() {
  if (!excelDatabaseDirectoryHandle) return;
  clearTimeout(excelDatabaseSyncTimer);
  excelDatabaseSyncTimer = setTimeout(() => writeExcelDatabaseFiles().catch(() => {
    setExcelSyncStatus("Excel database sync paused. Click Sync Excel Database again.", true);
    excelDatabaseDirectoryHandle = null;
  }), 650);
}

function databaseExcelFiles() {
  const sheets = allSheets();
  const byName = name => sheets.filter(s => s.name === name);
  return {
    "Customers.xlsx": byName("Customers"),
    "HSN_Codes.xlsx": byName("HSN_SAC_Master"),
    "Invoice_History.xlsx": ["Invoices", "Invoice_Items", "GST_Summary", "Payments", "Audit_Log"].flatMap(byName),
    "Company_Settings.xlsx": byName("Company_Settings"),
    "Payments.xlsx": byName("Payments"),
    "GST_Summary.xlsx": byName("GST_Summary"),
    "Audit_Log.xlsx": byName("Audit_Log"),
    "EKOVITS_Invoice_Database.xlsx": sheets
  };
}

async function writeExcelDatabaseFiles() {
  if (!excelDatabaseDirectoryHandle) return;
  const files = databaseExcelFiles();
  for (const [fileName, sheets] of Object.entries(files)) {
    const fileHandle = await excelDatabaseDirectoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(await createXlsxBlob(sheets));
    await writable.close();
  }
  setExcelSyncStatus(`XLSX database synced ${new Date().toLocaleTimeString()}.`);
}

async function downloadDatabaseXlsx() {
  download("EKOVITS_Invoice_Database.xlsx", await createXlsxBlob(allSheets()), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

async function createXlsxBlob(sheets) {
  if (window.JSZip) {
    const zip = new window.JSZip();
    xlsxPackageFiles(sheets).forEach(file => zip.file(file.name, file.content));
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  }
  return createStoredZipBlob(xlsxPackageFiles(sheets));
}

function xlsxPackageFiles(sheets) {
  const safeSheets = sheets.length ? sheets : [{ name: "Sheet1", headers: ["No data"], rows: [] }];
  const workbookSheets = safeSheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${safeSheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safeSheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>` },
    ...safeSheets.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: xlsxSheetXml(sheet) }))
  ];
}

function createStoredZipBlob(files) {
  const encoder = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  files.forEach(file => {
    const name = encoder.encode(file.name), data = encoder.encode(file.content), crc = crc32(data);
    const local = new Uint8Array(30 + name.length), view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0, true); view.setUint16(8, 0, true); view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
    local.set(name, 30); chunks.push(local, data);
    const entry = new Uint8Array(46 + name.length), entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true); entryView.setUint16(4, 20, true); entryView.setUint16(6, 20, true); entryView.setUint16(8, 0, true); entryView.setUint16(10, 0, true); entryView.setUint32(16, crc, true); entryView.setUint32(20, data.length, true); entryView.setUint32(24, data.length, true); entryView.setUint16(28, name.length, true); entryView.setUint32(42, offset, true);
    entry.set(name, 46); central.push(entry); offset += local.length + data.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.length, 0), end = new Uint8Array(22), endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true); endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function xlsxSheetXml(sheet) {
  const rows = [sheet.headers || [], ...(sheet.rows || [])];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${(row || []).map((value, c) => xlsxCell(value, r + 1, c + 1)).join("")}</row>`).join("")}</sheetData></worksheet>`;
}

function xlsxCell(value, row, column) {
  const ref = `${xlsxColumnName(column)}${row}`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function xlsxColumnName(column) {
  let out = "";
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  return out;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[m]));
}

function setExcelSyncStatus(message, error = false) {
  const el = byId("excelSyncStatus");
  if (el) { el.textContent = message; el.classList.toggle("err-text", error); }
}
function exportCsv(name, rows) { download(name, rows.map(r => r.map(csvCell).join(",")).join("\n"), "text/csv"); }
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function allSheets() {
  return [
    { name: "Company_Settings", headers: ["Field", "Value"], rows: Object.entries(state.settings).filter(([k]) => !["logo", "stamp", "signature"].includes(k)) },
    { name: "Customers", headers: customerRows()[0], rows: customerRows().slice(1) },
    { name: "HSN_SAC_Master", headers: hsnRows()[0], rows: hsnRows().slice(1) },
    { name: "Invoices", headers: invoiceRows()[0], rows: invoiceRows().slice(1) },
    { name: "Invoice_Items", headers: itemRows()[0], rows: itemRows().slice(1) },
    { name: "Payments", headers: paymentRows()[0], rows: paymentRows().slice(1) },
    ...reportSheets(),
    { name: "Audit_Log", headers: auditRows()[0], rows: auditRows().slice(1) }
  ];
}
function reportSheets() {
  return [
    { name: "GST_Summary", headers: ["Metric", "Value"], rows: [["Taxable", money(sum(state.invoices, i => i.totals.taxableCents))], ["CGST", money(sum(state.invoices, i => i.totals.cgstCents))], ["SGST", money(sum(state.invoices, i => i.totals.sgstCents))], ["IGST", money(sum(state.invoices, i => i.totals.igstCents))], ["Total GST", money(sum(state.invoices, i => i.totals.totalGstCents))]] },
    { name: "HSN_Summary", headers: ["HSN/SAC", "Taxable", "GST", "Invoice Value"], rows: groupByItems(state.invoices) },
    { name: "Customer_Sales", headers: ["Customer", "Invoices", "Taxable", "Invoice Value"], rows: groupBy(state.invoices, i => i.clientName) },
    { name: "Monthly_Sales", headers: ["Month", "Invoices", "Taxable", "Invoice Value"], rows: groupBy(state.invoices, i => (i.invoiceDate || "").slice(0, 7)) }
  ];
}

function customerRows() { return [["Customer ID","Client/Company Name","Billing Address","Shipping Address","Contact Person","Contact Number","Email ID","GSTIN","State","State Code","PAN","Customer Type","Notes","Active","Date Added","Last Updated"], ...state.customers.map(c => [c.id,c.name,c.billingAddress,c.shippingAddress,c.contactPerson,c.contactNumber,c.email,c.gstin,c.state,c.stateCode,c.pan,c.type,c.notes,c.active,c.createdAt,c.updatedAt])]; }
function hsnRows() { return [["HSN/SAC Code","Description","GST Rate","CGST Rate","SGST Rate","IGST Rate","Unit","Active","Notes"], ...state.hsn.map(h => [h.code,h.description,h.gstRate,h.cgstRate,h.sgstRate,h.igstRate,h.unit,h.active,h.notes])]; }
function invoiceRows() { return [["Invoice ID","Invoice Number","Invoice Date","Client Name","Client GSTIN","Taxable Value","CGST","SGST","IGST","Total GST","Grand Total","Payment Status","Invoice Status","Due Date","Created Date","Updated Date"], ...state.invoices.map(i => [i.id,i.invoiceNo,i.invoiceDate,i.clientName,i.clientGstin,money(i.totals.taxableCents),money(i.totals.cgstCents),money(i.totals.sgstCents),money(i.totals.igstCents),money(i.totals.totalGstCents),money(i.totals.grandTotalCents),i.paymentStatus,i.invoiceStatus,i.dueDate,i.createdAt,i.updatedAt])]; }
function itemRows() { return [["Invoice ID","Invoice Number","Sr No","Description","HSN/SAC","GST Rate","Qty","Rate","Taxable Amount"], ...state.invoices.flatMap(i => i.items.map(it => [i.id,i.invoiceNo,it.srNo,it.description,it.hsn,it.gstRate,it.qty,it.rate,money(it.taxableCents)]))]; }
function paymentRows() { return [["Invoice Number","Payment Status","Payment Date","Amount Paid","Payment Mode","Reference","Notes"], ...state.invoices.map(i => [i.invoiceNo,i.paymentStatus,i.paymentDate || "",money(i.amountPaidCents || 0),i.paymentMode || "",i.paymentRef || "",i.paymentNotes || ""])]; }
function auditRows() { return [["Action","Invoice Number","Date/Time","Old Value","New Value","Reason"], ...state.audit.map(a => [a.action,a.invoiceNo,a.at,a.oldValue,a.newValue,a.reason])]; }

async function restoreSampleData() {
  if (!confirm("Restore sample settings/customer/HSN? Existing invoices remain.")) return;
  await put("settings", defaultSettings); await put("customers", sampleCustomer); await put("hsn", sampleHsn);
  await refresh(); renderAll(); scheduleLiveExcelSync(); resetInvoiceForm(); toast("Sample data restored.");
}

async function audit(action, invoiceNo, oldValue, newValue, reason) {
  await put("audit", { id: uid("aud"), action, invoiceNo, at: new Date().toISOString(), user: "Local operator", oldValue: String(oldValue || ""), newValue: String(newValue || ""), reason: reason || "" });
}

function table(headers, rows) {
  return `<table class="data-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${String(c ?? "")}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No records.</td></tr>`}</tbody></table>`;
}
function groupBy(invoices, keyFn) {
  const map = new Map();
  invoices.filter(i => i.invoiceStatus !== "Cancelled").forEach(i => {
    const key = keyFn(i) || "Unspecified", x = map.get(key) || { count: 0, taxable: 0, total: 0 };
    x.count += 1; x.taxable += i.totals.taxableCents; x.total += i.totals.grandTotalCents; map.set(key, x);
  });
  return [...map.entries()].map(([k, v]) => [k, v.count, inr(v.taxable), inr(v.total)]);
}
function groupByItems(invoices) {
  const map = new Map();
  invoices.filter(i => i.invoiceStatus !== "Cancelled").forEach(i => {
    const groups = i.totals?.gstBreakdown || buildGstBreakdown(i.items, i.gstType);
    groups.forEach(g => {
      const x = map.get(g.hsn) || { taxable: 0, gst: 0, total: 0 };
      const gst = g.cgstCents + g.sgstCents + g.igstCents;
      x.taxable += g.taxableCents; x.gst += gst; x.total += g.taxableCents + gst; map.set(g.hsn, x);
    });
  });
  return [...map.entries()].map(([k, v]) => [k, inr(v.taxable), inr(v.gst), inr(v.total)]);
}
function filteredInvoices() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  return state.invoices.filter(i => {
    const d = new Date(i.invoiceDate || i.createdAt);
    if (currentRange === "all") return true;
    if (currentRange === "today") return d.toDateString() === now.toDateString();
    if (currentRange === "week") return now - d <= 7 * 86400000;
    if (currentRange === "month") return d.getFullYear() === y && d.getMonth() === m;
    if (currentRange === "fy") {
      const fyStart = new Date(now.getMonth() >= 3 ? y : y - 1, 3, 1);
      const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31, 23, 59, 59);
      return d >= fyStart && d <= fyEnd;
    }
    return true;
  });
}

function resolvedGstType(customerState, selected) {
  if (selected === "intra" || selected === "inter") return selected;
  return (customerState || "").trim().toLowerCase() === (state.settings?.state || "").trim().toLowerCase() ? "intra" : "inter";
}
function validGstin(v) { return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(v || "").toUpperCase()); }
function moneyCents(n) { return Math.round((Number(n) || 0) * 100); }
function money(cents) { return (Number(cents || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function inr(cents) { return "₹" + money(cents); }
function signedInr(cents) { return (cents < 0 ? "-₹" : "₹") + money(Math.abs(cents)); }
function sum(arr, fn) { return arr.reduce((a, b) => a + (fn(b) || 0), 0); }
function sumQty(inv) { return inv.items.reduce((a, b) => a + Number(b.qty || 0), 0); }
function firstHsn(inv) { return [...new Set(inv.items.map(i => i.hsn).filter(Boolean))].join(", "); }
function rateFull(inv) { return inv.items[0]?.gstRate || 0; }
function rateHalf(inv) { return (rateFull(inv) / 2).toFixed(rateFull(inv) % 2 ? 2 : 0); }
function uid(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function byId(id) { return document.getElementById(id); }
function setVal(id, v) { if (byId(id)) byId(id).value = v ?? ""; }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
function escapeAttr(s) { return escapeHtml(s).replace(/\n/g, " "); }
function nl(s) { return escapeHtml(s).replace(/\n/g, "<br>"); }
function formatCompanyAddress(s) { return escapeHtml(s).replace(/\s*\n\s*/g, "<br>"); }
function csvCell(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString("en-IN") : ""; }
function formatDateTime(d) { return d ? new Date(d).toLocaleString("en-IN") : ""; }
function badgeClass(i) { if (i.invoiceStatus === "Cancelled") return "cancel"; if (i.paymentStatus === "Paid") return "paid"; if (i.paymentStatus === "Partially Paid") return "partial"; if (i.invoiceStatus === "Draft") return "draft-b"; return "unpaid"; }
function summarizeInvoice(i) { return `${i.invoiceNo}: ${i.clientName}, taxable ${money(i.totals.taxableCents)}, GST ${money(i.totals.totalGstCents)}, total ${money(i.totals.grandTotalCents)}`; }
function toast(msg, type = "") { const t = byId("toast"); t.textContent = msg; t.className = `toast show ${type}`; setTimeout(() => t.classList.remove("show"), 3600); }

function amountInWords(cents) {
  const rupees = Math.floor(Math.abs(cents) / 100), paise = Math.abs(cents) % 100;
  const main = numberWords(rupees) || "Zero";
  return paise ? `${main} and ${numberWords(paise)} Paise Only` : `${main} Only`;
}
function numberWords(n) {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two = x => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  const three = x => x >= 100 ? ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x);
  let out = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) out += three(crore) + " Crore ";
  if (lakh) out += three(lakh) + " Lakh ";
  if (thousand) out += three(thousand) + " Thousand ";
  if (n) out += three(n);
  return out.trim();
}

window.viewInvoice = viewInvoice;
window.editInvoice = editInvoice;
window.duplicateInvoice = duplicateInvoice;
window.cancelInvoice = cancelInvoice;
window.deleteInvoice = deleteInvoice;
window.openPaymentModal = openPaymentModal;
window.printSavedInvoice = printSavedInvoice;
window.openCustomerModal = openCustomerModal;
window.openHsnModal = openHsnModal;
window.deactivateCustomer = deactivateCustomer;
window.deactivateHsn = deactivateHsn;
