import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { pool } from "../db/connection.js";
import { createCustomer, updateCustomer } from "../services/customerService.js";
import { createHsn } from "../services/hsnService.js";
import { updateSettings, getSettings } from "../services/settingsService.js";
import { createInvoice } from "../services/invoiceService.js";
import { createPayment } from "../services/paymentService.js";
import { audit } from "../services/auditService.js";
import { toCents } from "../utils/money.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyPath = process.argv[2] || path.resolve(__dirname, "../../legacy-data/EKOVITS_Invoice_Database.xlsx");

function rows(workbook, sheet) {
  const ws = workbook.Sheets[sheet];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
}

function settingsFromRows(rows) {
  const mapped = {};
  rows.forEach(row => {
    if (row.Field) mapped[row.Field] = row.Value;
  });
  return {
    name: mapped.name,
    address: mapped.address,
    contact: mapped.contact,
    email: mapped.email,
    website: mapped.website,
    gstin: mapped.gstin,
    state: mapped.state,
    stateCode: mapped.stateCode,
    bankName: mapped.bankName,
    accountNo: mapped.accountNo,
    ifsc: mapped.ifsc,
    branch: mapped.branch,
    signatory: mapped.signatory,
    invoicePrefix: mapped.invoicePrefix || "",
    nextInvoiceNumber: Number(mapped.nextInvoiceNumber || 202621)
  };
}

async function main() {
  const workbook = XLSX.readFile(legacyPath);
  const failures = [];
  const customers = rows(workbook, "Customers");
  const hsn = rows(workbook, "HSN_SAC_Master");
  const invoices = rows(workbook, "Invoices");
  const items = rows(workbook, "Invoice_Items");
  const payments = rows(workbook, "Payments");
  const auditRows = rows(workbook, "Audit_Log");

  await updateSettings(settingsFromRows(rows(workbook, "Company_Settings")));
  for (const row of customers) {
    try {
      const customer = {
        id: row["Customer ID"],
        name: row["Client/Company Name"],
        billingAddress: row["Billing Address"] || ".",
        shippingAddress: row["Shipping Address"],
        contactPerson: row["Contact Person"],
        contactNumber: row["Contact Number"],
        email: row["Email ID"],
        gstin: row.GSTIN,
        state: row.State || "Maharashtra",
        stateCode: row["State Code"] || "27",
        pan: row.PAN,
        customerType: row["Customer Type"],
        notes: row.Notes,
        active: String(row.Active).toLowerCase() !== "false"
      };
      const exists = await pool.query("SELECT 1 FROM customers WHERE id=$1", [customer.id]);
      if (exists.rowCount) await updateCustomer(customer.id, customer);
      else await createCustomer(customer);
    } catch (error) {
      failures.push({ sheet: "Customers", row, error: error.message });
    }
  }
  for (const row of hsn) {
    try {
      await createHsn({
        id: `hsn_${row["HSN/SAC Code"]}`,
        code: String(row["HSN/SAC Code"]),
        description: row.Description,
        gstRate: Number(row["GST Rate"] || 0),
        cgstRate: Number(row["CGST Rate"] || 0),
        sgstRate: Number(row["SGST Rate"] || 0),
        igstRate: Number(row["IGST Rate"] || row["GST Rate"] || 0),
        unit: row.Unit || "No.",
        notes: row.Notes || "",
        active: String(row.Active).toLowerCase() !== "false"
      });
    } catch (error) {
      failures.push({ sheet: "HSN_SAC_Master", row, error: error.message });
    }
  }
  const itemsByInvoice = new Map();
  items.forEach(row => {
    const invoiceNo = String(row["Invoice Number"]);
    const list = itemsByInvoice.get(invoiceNo) || [];
    list.push({
      srNo: Number(row["Sr No"] || list.length + 1),
      description: row.Description,
      hsn: String(row["HSN/SAC"]),
      gstRate: Number(row["GST Rate"] || 0),
      qty: Number(row.Qty || 0),
      rate: Number(row.Rate || 0)
    });
    itemsByInvoice.set(invoiceNo, list);
  });
  for (const row of invoices) {
    try {
      const invoiceNo = String(row["Invoice Number"]);
      const exists = await pool.query("SELECT 1 FROM invoices WHERE invoice_no=$1", [invoiceNo]);
      if (exists.rowCount) continue;
      await createInvoice({
        id: row["Invoice ID"],
        invoiceNo,
        invoiceDate: row["Invoice Date"],
        dueDate: row["Due Date"],
        clientName: row["Client Name"],
        clientAddress: ".",
        clientGstin: row["Client GSTIN"],
        clientState: "Maharashtra",
        clientStateCode: "27",
        gstType: Number(toCents(row.IGST)) > 0 ? "inter" : "intra",
        invoiceStatus: row["Invoice Status"] || "Final",
        paymentTerms: "Due on receipt",
        items: itemsByInvoice.get(String(row["Invoice Number"])) || []
      });
    } catch (error) {
      failures.push({ sheet: "Invoices", row, error: error.message });
    }
  }
  const { rows: dbInvoices } = await pool.query("SELECT id, invoice_no FROM invoices");
  const invoiceByNo = new Map(dbInvoices.map(i => [i.invoice_no, i.id]));

  // Self-heal the next-invoice-number counter: never trust the spreadsheet's
  // Company_Settings value blindly, since it can be stale relative to the
  // actual imported invoice history and would otherwise cause the app to
  // hand out an invoice number that has already been issued to a client.
  const currentSettings = await getSettings();
  const prefix = currentSettings.invoicePrefix || "";
  const highestImported = dbInvoices.reduce((max, row) => {
    const numeric = Number(String(row.invoice_no).replace(prefix, ""));
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, 0);
  if (highestImported >= currentSettings.nextInvoiceNumber) {
    await updateSettings({ ...currentSettings, nextInvoiceNumber: highestImported + 1 });
    console.log(`Advanced next_invoice_number to ${highestImported + 1} based on imported invoice history.`);
  }

  for (const row of payments) {
    try {
      const invoiceId = invoiceByNo.get(String(row["Invoice Number"]));
      if (invoiceId && toCents(row["Amount Paid"]) > 0) {
        await createPayment({
          invoiceId,
          paymentDate: row["Payment Date"] || null,
          amount: row["Amount Paid"],
          paymentMode: row["Payment Mode"],
          reference: row.Reference,
          notes: row.Notes
        });
      }
    } catch (error) {
      failures.push({ sheet: "Payments", row, error: error.message });
    }
  }
  for (const row of auditRows) {
    try {
      await audit(
        row.Action || "Legacy Audit",
        "legacy",
        null,
        row["New Value"] || row["Old Value"] || "",
        wrapLegacyValue(row["Old Value"]),
        wrapLegacyValue(row["New Value"]),
        row.Reason || "",
        null,
        String(row["Invoice Number"] || "")
      );
    } catch (error) {
      failures.push({ sheet: "Audit_Log", row, error: error.message });
    }
  }
  console.log(JSON.stringify({ importedFrom: legacyPath, failures }, null, 2));
  await pool.end();
}

function wrapLegacyValue(value) {
  if (value === null || value === undefined || value === "") return null;
  return { legacyValue: String(value) };
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
