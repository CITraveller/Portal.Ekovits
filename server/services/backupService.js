import XLSX from "xlsx";
import { query, withTransaction } from "../db/connection.js";
import { listCustomers } from "./customerService.js";
import { listHsn } from "./hsnService.js";
import { listInvoices } from "./invoiceService.js";
import { listPayments } from "./paymentService.js";
import { getSettings } from "./settingsService.js";
import { listAudit, audit } from "./auditService.js";

export async function jsonBackup() {
  return {
    exportedAt: new Date().toISOString(),
    settings: await getSettings(),
    customers: await listCustomers(),
    hsn: await listHsn(),
    invoices: await listInvoices(),
    payments: await listPayments(),
    audit: await listAudit()
  };
}

export async function restoreJson(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid backup payload");
  await audit("Data Imported", "backup", null, "JSON restore requested", null, { counts: Object.keys(payload) });
  return { restored: false, message: "Use the Excel importer or psql for destructive full restores. JSON restore validation endpoint accepted the file." };
}

export async function exportWorkbookBuffer() {
  const backup = await jsonBackup();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([flattenSettings(backup.settings)]), "Company_Settings");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(backup.customers), "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(backup.hsn), "HSN_SAC_Master");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(backup.invoices.map(flattenInvoice)), "Invoices");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(backup.invoices.flatMap(i => i.items.map(it => ({ invoiceId: i.id, invoiceNo: i.invoiceNo, ...it })))), "Invoice_Items");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(backup.payments), "Payments");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(backup.audit), "Audit_Log");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function flattenSettings(settings) {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : value]));
}

function flattenInvoice(invoice) {
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.invoiceDate,
    clientName: invoice.clientName,
    clientGstin: invoice.clientGstin,
    taxableCents: invoice.totals.taxableCents,
    cgstCents: invoice.totals.cgstCents,
    sgstCents: invoice.totals.sgstCents,
    igstCents: invoice.totals.igstCents,
    totalGstCents: invoice.totals.totalGstCents,
    grandTotalCents: invoice.totals.grandTotalCents,
    paymentStatus: invoice.paymentStatus,
    invoiceStatus: invoice.invoiceStatus,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt
  };
}
