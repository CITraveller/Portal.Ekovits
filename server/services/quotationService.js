import { query, withTransaction } from "../db/connection.js";
import { calculateTotals, resolvedGstType } from "../utils/calculations.js";
import { amountInWords, toCents } from "../utils/money.js";
import { badRequest, requireFields, validateEmail, validateGstin } from "../utils/validation.js";
import { uid } from "../utils/ids.js";
import { getSettings } from "./settingsService.js";
import { audit } from "./auditService.js";

const statuses = new Set(["Draft", "Sent", "Accepted", "Rejected", "Expired", "Cancelled"]);

export async function listQuotations(search = "", filters = {}) {
  await expireOldQuotations();
  const params = [];
  const clauses = ["q.deleted_at IS NULL"];
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(q.quotation_no ILIKE $${params.length} OR q.client_name ILIKE $${params.length} OR q.client_gstin ILIKE $${params.length} OR q.quotation_status ILIKE $${params.length})`);
  }
  if (statuses.has(filters.status)) {
    params.push(filters.status);
    clauses.push(`q.quotation_status=$${params.length}`);
  }
  const { rows } = await query(`${baseQuotationSelect(`WHERE ${clauses.join(" AND ")}`)} ORDER BY q.created_at DESC`, params);
  return rows.map(mapQuotation);
}

export async function getQuotation(id) {
  await expireOldQuotations();
  const { rows } = await query(baseQuotationSelect("WHERE q.id=$1 AND q.deleted_at IS NULL"), [id]);
  if (!rows[0]) throw notFound("Quotation not found");
  return mapQuotation(rows[0]);
}

export async function previewNextQuotationNumber() {
  return withTransaction(async (client) => {
    await ensureSequence(client);
    const { rows } = await client.query("SELECT prefix, next_number FROM quotation_number_sequences WHERE id='default'");
    return formatSequenceRow(rows[0]);
  });
}

export async function createQuotation(body, user = null) {
  validateQuotationInput(body);
  return withTransaction(async (client) => {
    const settings = await getSettings(client);
    const quotationNo = body.quotationNo || (await reserveQuotationNumberWithClient(client)).quotationNo;
    const gstType = resolvedGstType(settings.state, body.clientState, body.gstType || "auto");
    const totals = calculateTotals(body.items, gstType);
    const id = body.id || uid("quo");
    const snapshot = body.companySnapshot || settings;
    const { rows } = await client.query(
      `INSERT INTO quotations (
        id,quotation_no,quotation_date,valid_until,gst_type,gst_override,reference_no,subject,customer_id,
        client_name,client_address,client_contact,client_email,client_gstin,client_state,client_state_code,notes,terms,company_snapshot,
        taxable_cents,cgst_cents,sgst_cents,igst_cents,total_gst_cents,round_off_cents,grand_total_cents,quotation_status,revision,created_by,updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,0,$28,$28)
      RETURNING *`,
      [id, quotationNo, body.quotationDate, body.validUntil || null, gstType, (body.gstType || "auto") !== "auto",
        body.referenceNo || "", body.subject || "", body.customerId || null, body.clientName, body.clientAddress,
        body.clientContact || "", body.clientEmail || "", String(body.clientGstin || "").toUpperCase(), body.clientState || "",
        body.clientStateCode || "", body.notes || "", body.terms || "", snapshot, totals.taxableCents, totals.cgstCents,
        totals.sgstCents, totals.igstCents, totals.totalGstCents, totals.roundOffCents, totals.grandTotalCents,
        body.quotationStatus || "Draft", user?.sub || user?.id || null]
    );
    await insertItems(client, id, totals.items);
    await audit("Quotation Created", "quotation", id, `Quotation ${quotationNo} created`, null, rows[0], "", client);
    return getQuotationWithClient(client, id);
  });
}

export async function updateQuotation(id, body, user = null) {
  const old = await getQuotation(id);
  if (old.quotationStatus === "Cancelled") throw badRequest("Cancelled quotations cannot be edited");
  validateQuotationInput({ ...old, ...body, items: body.items || old.items });
  const nextStatus = body.quotationStatus || old.quotationStatus;
  validateStatusTransition(old.quotationStatus, nextStatus);
  return withTransaction(async (client) => {
    const settings = await getSettings(client);
    const next = { ...old, ...body };
    const gstType = resolvedGstType(settings.state, next.clientState, next.gstType || "auto");
    const totals = calculateTotals(next.items, gstType);
    await client.query(
      `UPDATE quotations SET quotation_date=$2,valid_until=$3,gst_type=$4,gst_override=$5,reference_no=$6,subject=$7,customer_id=$8,
       client_name=$9,client_address=$10,client_contact=$11,client_email=$12,client_gstin=$13,client_state=$14,client_state_code=$15,
       notes=$16,terms=$17,taxable_cents=$18,cgst_cents=$19,sgst_cents=$20,igst_cents=$21,total_gst_cents=$22,round_off_cents=$23,
       grand_total_cents=$24,quotation_status=$25,revision=revision+1,updated_at=now(),updated_by=$26
       WHERE id=$1 AND deleted_at IS NULL`,
      [id, next.quotationDate, next.validUntil || null, gstType, (next.gstType || "auto") !== "auto", next.referenceNo || "",
        next.subject || "", next.customerId || null, next.clientName, next.clientAddress, next.clientContact || "",
        next.clientEmail || "", String(next.clientGstin || "").toUpperCase(), next.clientState || "", next.clientStateCode || "",
        next.notes || "", next.terms || "", totals.taxableCents, totals.cgstCents, totals.sgstCents, totals.igstCents,
        totals.totalGstCents, totals.roundOffCents, totals.grandTotalCents, nextStatus,
        user?.sub || user?.id || null]
    );
    await client.query("DELETE FROM quotation_items WHERE quotation_id=$1", [id]);
    await insertItems(client, id, totals.items);
    await audit("Quotation Updated", "quotation", id, `Quotation ${old.quotationNo} updated`, old, next, "", client);
    return getQuotationWithClient(client, id);
  });
}

export async function duplicateQuotation(id, user = null) {
  const source = await getQuotation(id);
  const copy = {
    ...source,
    id: undefined,
    quotationNo: undefined,
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: "",
    quotationStatus: "Draft",
    items: source.items
  };
  return createQuotation(copy, user);
}

export async function cancelQuotation(id, reason, user = null) {
  if (!reason) throw badRequest("Cancellation reason is required");
  const old = await getQuotation(id);
  const { rows } = await query(
    `UPDATE quotations SET quotation_status='Cancelled', cancellation_reason=$2, cancelled_at=now(), cancelled_by=$3, updated_at=now(), updated_by=$3
     WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
    [id, reason, user?.sub || user?.id || null]
  );
  await audit("Quotation Cancelled", "quotation", id, `Quotation ${old.quotationNo} cancelled`, old, rows[0], reason);
  return getQuotation(id);
}

export async function deleteQuotation(id, reason = "", user = null) {
  if (!String(reason || "").trim()) throw badRequest("Deletion reason is required");
  const old = await getQuotation(id);
  if (old.quotationStatus === "Draft") {
    await query("DELETE FROM quotations WHERE id=$1", [id]);
    await audit("Quotation Deleted", "quotation", id, `Draft quotation ${old.quotationNo} deleted`, old, null, reason);
    return { deleted: true, mode: "hard" };
  }
  await query(
    "UPDATE quotations SET deleted_at=now(), deleted_reason=$2, deleted_by=$3, updated_at=now(), updated_by=$3 WHERE id=$1",
    [id, reason, user?.sub || user?.id || null]
  );
  await audit("Quotation Soft Deleted", "quotation", id, `Quotation ${old.quotationNo} hidden from active records`, old, { deleted: true }, reason);
  return { deleted: true, mode: "soft" };
}

async function insertItems(client, quotationId, items) {
  for (const item of items) {
    await client.query(
      `INSERT INTO quotation_items (id,quotation_id,sr_no,description,hsn,gst_rate,qty,rate_cents,taxable_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [item.id || uid("qitem"), quotationId, item.srNo, item.description, item.hsn, item.gstRate, item.qty, item.rateCents, item.taxableCents]
    );
  }
}

function validateQuotationInput(body) {
  requireFields(body, ["quotationDate", "clientName", "clientAddress"]);
  if (!statuses.has(body.quotationStatus || "Draft")) throw badRequest("Invalid quotation status");
  if (!Array.isArray(body.items) || !body.items.length) throw badRequest("At least one quotation item is required");
  if (!validateGstin(body.clientGstin)) throw badRequest("Invalid client GSTIN format");
  if (!validateEmail(body.clientEmail)) throw badRequest("Invalid client email format");
  body.items.forEach((item) => {
    if (!item.description || !item.hsn) throw badRequest("Every line needs description and HSN/SAC");
    if (Number(item.gstRate) < 0 || Number(item.gstRate) > 100) throw badRequest("GST rate must be between 0 and 100");
    if (Number(item.qty) <= 0) throw badRequest("Quantity must be greater than zero");
    if (toCents(item.rate) < 0) throw badRequest("Rate cannot be negative");
  });
}

async function expireOldQuotations() {
  await query(
    `UPDATE quotations SET quotation_status='Expired', updated_at=now()
     WHERE deleted_at IS NULL
       AND quotation_status IN ('Draft','Sent')
       AND valid_until IS NOT NULL
       AND valid_until < CURRENT_DATE`
  );
}

function validateStatusTransition(from, to) {
  if (from === to) return;
  const allowed = {
    Draft: ["Sent", "Cancelled"],
    Sent: ["Accepted", "Rejected", "Expired", "Cancelled"],
    Rejected: ["Sent", "Cancelled"],
    Expired: ["Sent", "Cancelled"],
    Accepted: [],
    Cancelled: []
  };
  if (!allowed[from]?.includes(to)) throw badRequest(`Invalid quotation status transition from ${from} to ${to}`);
}

function baseQuotationSelect(where = "") {
  return `SELECT q.*,
    COALESCE(json_agg(json_build_object(
      'id', it.id, 'srNo', it.sr_no, 'description', it.description, 'hsn', it.hsn,
      'gstRate', it.gst_rate, 'qty', it.qty, 'rateCents', it.rate_cents, 'rate', it.rate_cents / 100.0,
      'taxableCents', it.taxable_cents, 'taxable', it.taxable_cents / 100.0
    ) ORDER BY it.sr_no) FILTER (WHERE it.id IS NOT NULL), '[]') AS items
    FROM quotations q LEFT JOIN quotation_items it ON it.quotation_id=q.id
    ${where}
    GROUP BY q.id`;
}

export function mapQuotation(row) {
  const totals = {
    taxableCents: Number(row.taxable_cents),
    cgstCents: Number(row.cgst_cents),
    sgstCents: Number(row.sgst_cents),
    igstCents: Number(row.igst_cents),
    totalGstCents: Number(row.total_gst_cents),
    roundOffCents: Number(row.round_off_cents),
    grandTotalCents: Number(row.grand_total_cents)
  };
  return {
    id: row.id,
    quotationNo: row.quotation_no,
    quotationDate: row.quotation_date,
    validUntil: row.valid_until,
    gstType: row.gst_type,
    gstOverride: row.gst_override,
    referenceNo: row.reference_no || "",
    subject: row.subject || "",
    customerId: row.customer_id,
    clientName: row.client_name,
    clientAddress: row.client_address,
    clientContact: row.client_contact || "",
    clientEmail: row.client_email || "",
    clientGstin: row.client_gstin || "",
    clientState: row.client_state || "",
    clientStateCode: row.client_state_code || "",
    notes: row.notes || "",
    terms: row.terms || "",
    companySnapshot: row.company_snapshot || {},
    items: Array.isArray(row.items) ? row.items : [],
    totals,
    amountWords: amountInWords(totals.grandTotalCents),
    quotationStatus: row.quotation_status,
    revision: row.revision,
    cancellationReason: row.cancellation_reason || "",
    cancelledAt: row.cancelled_at,
    deletedAt: row.deleted_at,
    deletedReason: row.deleted_reason || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getQuotationWithClient(client, id) {
  const { rows } = await client.query(baseQuotationSelect("WHERE q.id=$1"), [id]);
  return mapQuotation(rows[0]);
}

async function ensureSequence(client) {
  await client.query(`
    INSERT INTO quotation_number_sequences (id, prefix, next_number)
    VALUES ('default', 'EKV-', 20261)
    ON CONFLICT (id) DO NOTHING
  `);
  await client.query(`
    UPDATE quotation_number_sequences seq
    SET next_number = GREATEST(
      seq.next_number,
      COALESCE((
        SELECT MAX(substring(quotation_no from '([0-9]+)$')::bigint) + 1
        FROM quotations
        WHERE quotation_no ~ '[0-9]+$'
      ), seq.next_number)
    )
    WHERE seq.id = 'default'
  `);
}

async function reserveQuotationNumberWithClient(client) {
  await ensureSequence(client);
  const { rows } = await client.query(`
    UPDATE quotation_number_sequences
    SET next_number = next_number + 1, updated_at = now()
    WHERE id = 'default'
    RETURNING prefix, next_number - 1 AS reserved_number, next_number
  `);
  return formatSequenceRow(rows[0]);
}

function formatSequenceRow(row) {
  return {
    quotationNo: `${row.prefix || "EKV-"}${row.reserved_number ?? row.next_number}`,
    prefix: row.prefix || "EKV-",
    reservedNumber: Number(row.reserved_number ?? row.next_number),
    nextQuotationNumber: Number(row.next_number)
  };
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}
