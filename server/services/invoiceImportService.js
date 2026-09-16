import XLSX from "xlsx";
import { withTransaction } from "../db/connection.js";
import { calculateTotals, resolvedGstType } from "../utils/calculations.js";
import { toCents } from "../utils/money.js";
import { badRequest, validateEmail, validateGstin } from "../utils/validation.js";
import { uid } from "../utils/ids.js";
import { getSettings } from "./settingsService.js";
import { audit } from "./auditService.js";

const headers = [
  "Invoice Number", "Invoice Date", "Customer Name", "Customer GSTIN", "Customer Address", "Customer State",
  "Customer Email", "Customer Phone", "PO Number", "PO Date", "Payment Terms", "Due Date",
  "Subtotal / Taxable Value", "CGST", "SGST", "IGST", "Other Charges", "Discount", "Grand Total",
  "Invoice Status", "Notes", "Description", "HSN/SAC", "GST %", "Quantity", "Rate", "Line Discount",
  "Taxable Amount", "Line CGST", "Line SGST", "Line IGST", "Line Total"
];

export function importTemplateBuffer() {
  const workbook = XLSX.utils.book_new();
  const rows = [
    Object.fromEntries(headers.map(header => [header, ""])),
    {
      "Invoice Number": "INV-2024-001",
      "Invoice Date": "2024-04-01",
      "Customer Name": "Example Customer Pvt Ltd",
      "Customer GSTIN": "27AAAAA0000A1Z5",
      "Customer Address": "Billing address",
      "Customer State": "Maharashtra",
      "Customer Email": "accounts@example.com",
      "Customer Phone": "+91-9000000000",
      "PO Number": "PO-1001",
      "PO Date": "2024-03-30",
      "Payment Terms": "Due on receipt",
      "Due Date": "2024-04-15",
      "Invoice Status": "Final",
      "Notes": "Imported historical invoice",
      "Description": "Consulting services",
      "HSN/SAC": "998314",
      "GST %": 18,
      "Quantity": 1,
      "Rate": 10000
    }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows, { header: headers }), "Historical_Invoices");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export async function previewInvoiceImport(file) {
  const parsed = parseImportFile(file);
  return validateParsedInvoices(parsed);
}

export async function commitInvoiceImport(file, user = null) {
  const preview = await previewInvoiceImport(file);
  if (preview.errors.length) {
    throw badRequest("Import has validation errors. Please fix the file and preview again before importing.");
  }
  return withTransaction(async (client) => {
    const settings = await getSettings(client);
    const imported = [];
    for (const invoice of preview.invoices) {
      const existingCustomer = await findExistingCustomer(client, invoice);
      const gstType = resolvedGstType(settings.state, invoice.clientState, invoice.gstType || "auto");
      const totals = calculateTotals(invoice.items, gstType);
      const id = uid("inv");
      const notes = [invoice.notes, invoice.poDate ? `PO Date: ${invoice.poDate}` : ""].filter(Boolean).join("\n");
      const { rows } = await client.query(
        `INSERT INTO invoices (
          id,invoice_no,invoice_date,due_date,place_of_supply,reverse_charge,gst_type,gst_override,payment_terms,reference_no,
          customer_id,client_name,client_address,shipping_address,contact_person,client_contact,client_email,client_gstin,client_state,client_state_code,notes,company_snapshot,
          taxable_cents,cgst_cents,sgst_cents,igst_cents,total_gst_cents,round_off_cents,grand_total_cents,invoice_status,payment_status,revision,
          source,imported,imported_at,imported_by,created_by,updated_by
        ) VALUES ($1,$2,$3,$4,$5,'No',$6,false,$7,$8,$9,$10,$11,'','',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'Unpaid',0,
          'imported',true,now(),$27,$27,$27)
        RETURNING *`,
        [id, invoice.invoiceNo, invoice.invoiceDate, invoice.dueDate || null, invoice.clientState || settings.state, gstType,
          invoice.paymentTerms || "", invoice.poNumber || "", existingCustomer?.id || null, invoice.clientName, invoice.clientAddress,
          invoice.clientContact || "", invoice.clientEmail || "", String(invoice.clientGstin || "").toUpperCase(), invoice.clientState || "",
          invoice.clientStateCode || "", notes, settings, totals.taxableCents, totals.cgstCents, totals.sgstCents, totals.igstCents,
          totals.totalGstCents, totals.roundOffCents, totals.grandTotalCents, invoice.invoiceStatus || "Final", user?.sub || user?.id || null]
      );
      for (const item of totals.items) {
        await client.query(
          `INSERT INTO invoice_items (id,invoice_id,sr_no,description,hsn,gst_rate,qty,rate_cents,taxable_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [uid("item"), id, item.srNo, item.description, item.hsn, item.gstRate, item.qty, item.rateCents, item.taxableCents]
        );
      }
      await audit("Historical Invoice Imported", "invoice", id, `Imported historical invoice ${invoice.invoiceNo}`, null, rows[0], "", client, invoice.invoiceNo);
      imported.push({ id, invoiceNo: invoice.invoiceNo });
    }
    return {
      rowsFound: preview.rowsFound,
      successfullyImported: imported.length,
      skippedDuplicate: 0,
      failed: 0,
      imported
    };
  });
}

async function validateParsedInvoices(parsed) {
  const errors = [];
  const warnings = [];
  const byInvoice = new Map();
  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const invoiceNo = value(row, "Invoice Number");
    if (!invoiceNo) errors.push({ row: rowNumber, invoiceNo, message: "Invoice Number is required" });
    if (!byInvoice.has(invoiceNo)) byInvoice.set(invoiceNo, []);
    byInvoice.get(invoiceNo).push({ row, rowNumber });
  });

  const invoices = [];
  for (const [invoiceNo, group] of byInvoice.entries()) {
    if (!invoiceNo) continue;
    const first = group[0].row;
    const invoice = normalizeInvoice(first, group);
    validateInvoice(invoice, group, errors, warnings);
    invoices.push(invoice);
  }

  const invoiceNumbers = invoices.map(invoice => invoice.invoiceNo);
  const duplicateInFile = invoiceNumbers.filter((number, index) => invoiceNumbers.indexOf(number) !== index);
  duplicateInFile.forEach(number => errors.push({ invoiceNo: number, message: "Duplicate invoice number in import file" }));
  const duplicateExisting = invoiceNumbers.length ? await existingInvoiceNumbers(invoiceNumbers) : [];
  duplicateExisting.forEach(number => errors.push({ invoiceNo: number, message: "Invoice number already exists in database" }));

  return {
    rowsFound: parsed.rows.length,
    valid: errors.length ? 0 : invoices.length,
    warnings: warnings.length,
    errors,
    warningDetails: warnings,
    duplicates: duplicateExisting.length + duplicateInFile.length,
    invoices: errors.length ? [] : invoices
  };
}

function parseImportFile(file) {
  if (!file) throw badRequest("Import file is required");
  const original = String(file.originalname || "").toLowerCase();
  if (original.endsWith(".csv")) {
    return { rows: parseCsv(file.buffer.toString("utf8")) };
  }
  if (original.endsWith(".xlsx") || original.endsWith(".xls")) {
    const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return { rows: XLSX.utils.sheet_to_json(sheet, { defval: "" }) };
  }
  throw badRequest("Only CSV and Excel files are supported");
}

function normalizeInvoice(first, group) {
  const status = normalizeStatus(value(first, "Invoice Status"));
  const invoice = {
    invoiceNo: value(first, "Invoice Number"),
    invoiceDate: normalizeDate(value(first, "Invoice Date")),
    dueDate: normalizeDate(value(first, "Due Date")),
    clientName: value(first, "Customer Name"),
    clientGstin: value(first, "Customer GSTIN").toUpperCase(),
    clientAddress: value(first, "Customer Address"),
    clientState: value(first, "Customer State") || "Maharashtra",
    clientStateCode: "",
    clientEmail: value(first, "Customer Email"),
    clientContact: value(first, "Customer Phone"),
    poNumber: value(first, "PO Number"),
    poDate: normalizeDate(value(first, "PO Date")),
    paymentTerms: value(first, "Payment Terms"),
    invoiceStatus: status,
    notes: value(first, "Notes"),
    items: group.map(({ row }, index) => normalizeItem(row, index)).filter(Boolean)
  };
  if (!invoice.items.length && toCents(value(first, "Subtotal / Taxable Value")) > 0) {
    invoice.items.push({
      srNo: 1,
      description: invoice.notes || "Historical invoice amount",
      hsn: value(first, "HSN/SAC") || "Unspecified",
      gstRate: Number(value(first, "GST %") || 0),
      qty: 1,
      rate: Number(String(value(first, "Subtotal / Taxable Value")).replace(/[,₹\s]/g, "")),
      rateCents: toCents(value(first, "Subtotal / Taxable Value"))
    });
  }
  return invoice;
}

function normalizeItem(row, index) {
  const description = value(row, "Description");
  const hsn = value(row, "HSN/SAC");
  const qty = Number(value(row, "Quantity") || 0);
  const rate = Number(String(value(row, "Rate") || "0").replace(/[,₹\s]/g, ""));
  const taxable = toCents(value(row, "Taxable Amount"));
  if (!description && !hsn && !qty && !rate && !taxable) return null;
  const rateCents = rate ? toCents(rate) : qty > 0 && taxable > 0 ? Math.round(taxable / qty) : 0;
  return {
    srNo: index + 1,
    description,
    hsn,
    gstRate: Number(value(row, "GST %") || 0),
    qty,
    rate,
    rateCents
  };
}

function validateInvoice(invoice, group, errors, warnings) {
  const row = group[0].rowNumber;
  if (!invoice.invoiceDate) errors.push({ row, invoiceNo: invoice.invoiceNo, message: "Valid Invoice Date is required" });
  if (!invoice.clientName) errors.push({ row, invoiceNo: invoice.invoiceNo, message: "Customer Name is required" });
  if (!invoice.clientAddress) errors.push({ row, invoiceNo: invoice.invoiceNo, message: "Customer Address is required" });
  if (!validateGstin(invoice.clientGstin)) errors.push({ row, invoiceNo: invoice.invoiceNo, message: "Customer GSTIN is malformed" });
  if (!validateEmail(invoice.clientEmail)) errors.push({ row, invoiceNo: invoice.invoiceNo, message: "Customer Email is malformed" });
  if (!invoice.items.length) errors.push({ row, invoiceNo: invoice.invoiceNo, message: "At least one invoice line item is required" });
  invoice.items.forEach((item, index) => {
    const itemRow = group[index]?.rowNumber || row;
    if (!item.description) errors.push({ row: itemRow, invoiceNo: invoice.invoiceNo, message: "Line item description is required" });
    if (!item.hsn) errors.push({ row: itemRow, invoiceNo: invoice.invoiceNo, message: "Line item HSN/SAC is required" });
    if (Number(item.gstRate) < 0 || Number(item.gstRate) > 100) errors.push({ row: itemRow, invoiceNo: invoice.invoiceNo, message: "GST % must be between 0 and 100" });
    if (Number(item.qty) <= 0) errors.push({ row: itemRow, invoiceNo: invoice.invoiceNo, message: "Quantity must be greater than zero" });
    if (Number(item.rateCents) < 0) errors.push({ row: itemRow, invoiceNo: invoice.invoiceNo, message: "Rate cannot be negative" });
  });
  const suppliedTotal = toCents(value(group[0].row, "Grand Total"));
  if (suppliedTotal > 0) {
    const estimated = calculateTotals(invoice.items, "intra").grandTotalCents;
    if (Math.abs(suppliedTotal - estimated) > 100) {
      warnings.push({ row, invoiceNo: invoice.invoiceNo, message: "Supplied grand total differs from recalculated portal total" });
    }
  }
}

async function existingInvoiceNumbers(invoiceNumbers) {
  const { query } = await import("../db/connection.js");
  const { rows } = await query("SELECT invoice_no FROM invoices WHERE invoice_no = ANY($1)", [invoiceNumbers]);
  return rows.map(row => row.invoice_no);
}

async function findExistingCustomer(client, invoice) {
  const params = [];
  const clauses = [];
  if (invoice.clientGstin) {
    params.push(invoice.clientGstin);
    clauses.push(`upper(gstin)=upper($${params.length})`);
  }
  if (invoice.clientName) {
    params.push(invoice.clientName);
    clauses.push(`lower(name)=lower($${params.length})`);
  }
  if (!clauses.length) return null;
  const { rows } = await client.query(`SELECT id FROM customers WHERE active=true AND (${clauses.join(" OR ")}) LIMIT 1`, params);
  return rows[0] || null;
}

function value(row, key) {
  return String(row[key] ?? row[key.toLowerCase()] ?? "").trim();
}

function normalizeStatus(status) {
  const normalized = String(status || "Final").trim().toLowerCase();
  if (normalized === "draft") return "Draft";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  return "Final";
}

function normalizeDate(input) {
  if (!input) return "";
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input.toISOString().slice(0, 10);
  if (typeof input === "number") {
    const date = XLSX.SSF.parse_date_code(input);
    if (date) return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }
  const [header = [], ...body] = rows.filter(values => values.some(cell => String(cell).trim()));
  return body.map(values => Object.fromEntries(header.map((key, index) => [String(key).trim(), values[index] ?? ""])));
}
