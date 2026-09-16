import { query, withTransaction } from "../db/connection.js";
import { calculateTotals, resolvedGstType } from "../utils/calculations.js";
import { amountInWords, centsToAmount, toCents } from "../utils/money.js";
import { badRequest, requireFields, validateEmail, validateGstin } from "../utils/validation.js";
import { uid } from "../utils/ids.js";
import { getSettings } from "./settingsService.js";
import { audit } from "./auditService.js";

export async function listInvoices(search = "") {
  const params = [];
  let where = "";
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE i.invoice_no ILIKE $1 OR i.client_name ILIKE $1 OR i.client_gstin ILIKE $1
      OR i.payment_status ILIKE $1 OR i.invoice_status ILIKE $1 OR CAST(i.grand_total_cents / 100.0 AS TEXT) ILIKE $1`;
  }
  const { rows } = await query(`${baseInvoiceSelect(where)} ORDER BY i.created_at DESC`, params);
  return rows.map(mapInvoice);
}

export async function getInvoice(id) {
  const { rows } = await query(baseInvoiceSelect("WHERE i.id=$1"), [id]);
  if (!rows[0]) throw notFound("Invoice not found");
  return mapInvoice(rows[0]);
}

// Non-mutating: shows what the next invoice number WOULD be, without
// consuming it. Safe to call every time the New Invoice screen opens.
export async function previewNextInvoiceNumber() {
  return withTransaction(async (client) => {
    await client.query(`
      INSERT INTO invoice_number_sequences (id, prefix, next_number)
      SELECT 'default', invoice_prefix, next_invoice_number
      FROM company_settings
      WHERE id='company'
      ON CONFLICT (id) DO NOTHING
    `);
    const { rows } = await client.query(
      `SELECT prefix, next_number FROM invoice_number_sequences WHERE id='default'`
    );
    const row = rows[0];
    return {
      invoiceNo: `${row.prefix || ""}${row.next_number}`,
      prefix: row.prefix || "",
      reservedNumber: Number(row.next_number),
      nextInvoiceNumber: Number(row.next_number)
    };
  });
}

export async function createInvoice(body) {
  validateInvoiceInput(body);
  return withTransaction(async (client) => {
    const settings = await getSettings(client);
    const invoiceNo = body.invoiceNo || (await reserveInvoiceNumberWithClient(client)).invoiceNo;
    const gstType = resolvedGstType(settings.state, body.clientState, body.gstType || "auto");
    const totals = calculateTotals(body.items, gstType);
    const id = body.id || uid("inv");
    const snapshot = body.companySnapshot || settings;
    const { rows } = await client.query(
      `INSERT INTO invoices (
        id,invoice_no,invoice_date,due_date,place_of_supply,reverse_charge,gst_type,gst_override,payment_terms,reference_no,
        customer_id,client_name,client_address,shipping_address,contact_person,client_contact,client_email,client_gstin,client_state,client_state_code,notes,company_snapshot,
        taxable_cents,cgst_cents,sgst_cents,igst_cents,total_gst_cents,round_off_cents,grand_total_cents,invoice_status,payment_status,revision
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,'Unpaid',0)
      RETURNING *`,
      [id, invoiceNo, body.invoiceDate, body.dueDate || null, body.placeOfSupply || settings.state, body.reverseCharge || "No", gstType,
        (body.gstType || "auto") !== "auto", body.paymentTerms || "", body.referenceNo || "", body.customerId || null,
        body.clientName, body.clientAddress, body.shippingAddress || "", body.contactPerson || "", body.clientContact || "",
        body.clientEmail || "", String(body.clientGstin || "").toUpperCase(), body.clientState || "", body.clientStateCode || "",
        body.notes || "", snapshot, totals.taxableCents, totals.cgstCents, totals.sgstCents, totals.igstCents, totals.totalGstCents,
        totals.roundOffCents, totals.grandTotalCents, body.invoiceStatus || "Draft"]
    );
    await insertItems(client, id, totals.items);
    await audit("Invoice Created", "invoice", id, summarizeInvoice(rows[0]), null, rows[0], "", client, invoiceNo);
    return getInvoiceWithClient(client, id);
  });
}

export async function updateInvoice(id, body) {
  const old = await getInvoice(id);
  validateInvoiceInput({ ...old, ...body, items: body.items || old.items });
  if (old.invoiceStatus === "Final" && !String(body.editReason || "").trim()) {
    throw badRequest("Edit reason is required when correcting a final invoice");
  }
  return withTransaction(async (client) => {
    const settings = await getSettings(client);
    const next = { ...old, ...body };
    const gstType = resolvedGstType(settings.state, next.clientState, next.gstType || "auto");
    const totals = calculateTotals(next.items, gstType);
    await client.query(
      `UPDATE invoices SET invoice_date=$2,due_date=$3,place_of_supply=$4,reverse_charge=$5,gst_type=$6,gst_override=$7,payment_terms=$8,reference_no=$9,
       customer_id=$10,client_name=$11,client_address=$12,shipping_address=$13,contact_person=$14,client_contact=$15,client_email=$16,client_gstin=$17,
       client_state=$18,client_state_code=$19,notes=$20,taxable_cents=$21,cgst_cents=$22,sgst_cents=$23,igst_cents=$24,total_gst_cents=$25,
       round_off_cents=$26,grand_total_cents=$27,invoice_status=$28,revision=revision+1,updated_at=now()
       WHERE id=$1`,
      [id, next.invoiceDate, next.dueDate || null, next.placeOfSupply || settings.state, next.reverseCharge || "No", gstType,
        (next.gstType || "auto") !== "auto", next.paymentTerms || "", next.referenceNo || "", next.customerId || null,
        next.clientName, next.clientAddress, next.shippingAddress || "", next.contactPerson || "", next.clientContact || "", next.clientEmail || "",
        String(next.clientGstin || "").toUpperCase(), next.clientState || "", next.clientStateCode || "", next.notes || "",
        totals.taxableCents, totals.cgstCents, totals.sgstCents, totals.igstCents, totals.totalGstCents, totals.roundOffCents,
        totals.grandTotalCents, next.invoiceStatus || old.invoiceStatus]
    );
    await client.query("DELETE FROM invoice_items WHERE invoice_id=$1", [id]);
    await insertItems(client, id, totals.items);
    await refreshPaymentStatus(client, id);
    await audit(old.invoiceStatus === "Final" ? "Invoice Corrected" : "Invoice Updated", "invoice", id, `Invoice ${old.invoiceNo}`, old, next, body.editReason || "", client, old.invoiceNo);
    return getInvoiceWithClient(client, id);
  });
}

export async function duplicateInvoice(id) {
  const source = await getInvoice(id);
  const copy = {
    ...source,
    id: undefined,
    invoiceNo: undefined,
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    invoiceStatus: "Draft",
    items: source.items
  };
  return createInvoice(copy);
}

export async function cancelInvoice(id, reason) {
  if (!reason) throw badRequest("Cancellation reason is required");
  const old = await getInvoice(id);
  const { rows } = await query(
    "UPDATE invoices SET invoice_status='Cancelled', payment_status='Unpaid', cancellation_reason=$2, updated_at=now() WHERE id=$1 RETURNING *",
    [id, reason]
  );
  await audit("Invoice Cancelled", "invoice", id, `Invoice ${old.invoiceNo} cancelled`, old, rows[0], reason, null, old.invoiceNo);
  return getInvoice(id);
}

export async function deleteInvoice(id, reason = "") {
  const old = await getInvoice(id);
  await query("DELETE FROM invoices WHERE id=$1", [id]);
  await audit("Invoice Deleted", "invoice", id, `Invoice ${old.invoiceNo} deleted`, old, null, reason, null, old.invoiceNo);
  return { deleted: true };
}

async function insertItems(client, invoiceId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO invoice_items (id,invoice_id,sr_no,description,hsn,gst_rate,qty,rate_cents,taxable_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [item.id || uid("item"), invoiceId, item.srNo, item.description, item.hsn, item.gstRate, item.qty, item.rateCents, item.taxableCents]
    );
  }
}

export async function refreshPaymentStatus(client, invoiceId) {
  const { rows } = await client.query(
    `SELECT i.grand_total_cents, COALESCE(SUM(p.amount_cents),0)::bigint AS paid
     FROM invoices i LEFT JOIN payments p ON p.invoice_id=i.id WHERE i.id=$1 GROUP BY i.id`,
    [invoiceId]
  );
  const row = rows[0];
  if (!row) return;
  const paid = Number(row.paid);
  const total = Number(row.grand_total_cents);
  const status = paid <= 0 ? "Unpaid" : paid >= total ? "Paid" : "Partially Paid";
  await client.query("UPDATE invoices SET payment_status=$2, updated_at=now() WHERE id=$1", [invoiceId, status]);
}

async function getInvoiceWithClient(client, id) {
  const { rows } = await client.query(baseInvoiceSelect("WHERE i.id=$1"), [id]);
  return mapInvoice(rows[0]);
}

function validateInvoiceInput(body) {
  requireFields(body, ["invoiceDate", "clientName", "clientAddress"]);
  if (!Array.isArray(body.items) || !body.items.length) throw badRequest("At least one invoice item is required");
  if (!validateGstin(body.clientGstin)) throw badRequest("Invalid client GSTIN format");
  if (!validateEmail(body.clientEmail)) throw badRequest("Invalid client email format");
  body.items.forEach((item) => {
    if (!item.description || !item.hsn) throw badRequest("Every line needs description and HSN/SAC");
    if (Number(item.qty) <= 0) throw badRequest("Quantity must be greater than zero");
    if (toCents(item.rate) < 0) throw badRequest("Rate cannot be negative");
  });
}

function baseInvoiceSelect(where = "") {
  return `SELECT i.*,
    COALESCE(json_agg(json_build_object(
      'id', it.id, 'srNo', it.sr_no, 'description', it.description, 'hsn', it.hsn,
      'gstRate', it.gst_rate, 'qty', it.qty, 'rateCents', it.rate_cents, 'rate', it.rate_cents / 100.0,
      'taxableCents', it.taxable_cents, 'taxable', it.taxable_cents / 100.0
    ) ORDER BY it.sr_no) FILTER (WHERE it.id IS NOT NULL), '[]') AS items,
    COALESCE((SELECT SUM(amount_cents)::bigint FROM payments p WHERE p.invoice_id=i.id),0) AS amount_paid_cents
    FROM invoices i LEFT JOIN invoice_items it ON it.invoice_id=i.id
    ${where}
    GROUP BY i.id`;
}

export function mapInvoice(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    placeOfSupply: row.place_of_supply || "",
    reverseCharge: row.reverse_charge,
    gstType: row.gst_type,
    gstOverride: row.gst_override,
    paymentTerms: row.payment_terms || "",
    referenceNo: row.reference_no || "",
    customerId: row.customer_id,
    clientName: row.client_name,
    clientAddress: row.client_address,
    shippingAddress: row.shipping_address || "",
    contactPerson: row.contact_person || "",
    clientContact: row.client_contact || "",
    clientEmail: row.client_email || "",
    clientGstin: row.client_gstin || "",
    clientState: row.client_state || "",
    clientStateCode: row.client_state_code || "",
    notes: row.notes || "",
    companySnapshot: row.company_snapshot || {},
    items,
    totals: {
      taxableCents: Number(row.taxable_cents),
      cgstCents: Number(row.cgst_cents),
      sgstCents: Number(row.sgst_cents),
      igstCents: Number(row.igst_cents),
      totalGstCents: Number(row.total_gst_cents),
      roundOffCents: Number(row.round_off_cents),
      grandTotalCents: Number(row.grand_total_cents)
    },
    amountWords: amountInWords(row.grand_total_cents),
    amountPaidCents: Number(row.amount_paid_cents || 0),
    balanceCents: Math.max(0, Number(row.grand_total_cents) - Number(row.amount_paid_cents || 0)),
    invoiceStatus: row.invoice_status,
    paymentStatus: row.payment_status,
    revision: row.revision,
    cancellationReason: row.cancellation_reason || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function summarizeInvoice(row) {
  return `${row.invoice_no}: ${row.client_name}, taxable ${centsToAmount(row.taxable_cents).toLocaleString("en-IN", { minimumFractionDigits: 2 })}, GST ${centsToAmount(row.total_gst_cents).toLocaleString("en-IN", { minimumFractionDigits: 2 })}, total ${centsToAmount(row.grand_total_cents).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

async function reserveInvoiceNumberWithClient(client) {
  await client.query(`
    INSERT INTO invoice_number_sequences (id, prefix, next_number)
    SELECT 'default', invoice_prefix, next_invoice_number
    FROM company_settings
    WHERE id='company'
    ON CONFLICT (id) DO NOTHING
  `);
  const { rows } = await client.query(`
    UPDATE invoice_number_sequences
    SET next_number = next_number + 1, updated_at = now()
    WHERE id = 'default'
    RETURNING prefix, next_number - 1 AS reserved_number, next_number
  `);
  const row = rows[0];
  await client.query(
    "UPDATE company_settings SET invoice_prefix=$1, next_invoice_number=$2, updated_at=now() WHERE id='company'",
    [row.prefix || "", row.next_number]
  );
  return {
    invoiceNo: `${row.prefix || ""}${row.reserved_number}`,
    prefix: row.prefix || "",
    reservedNumber: Number(row.reserved_number),
    nextInvoiceNumber: Number(row.next_number)
  };
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}
