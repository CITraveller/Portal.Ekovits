import { query, withTransaction } from "../db/connection.js";
import { uid } from "../utils/ids.js";
import { badRequest, requireFields, validateEmail, validateGstin } from "../utils/validation.js";
import { audit } from "./auditService.js";

export async function listCustomers(search = "") {
  const params = [];
  let where = "";
  if (search) {
    params.push(`%${search}%`);
    where = "WHERE name ILIKE $1 OR gstin ILIKE $1 OR contact_number ILIKE $1 OR email ILIKE $1";
  }
  const { rows } = await query(`SELECT * FROM customers ${where} ORDER BY active DESC, name`, params);
  return rows.map(mapCustomer);
}

export async function getCustomer(id) {
  const { rows } = await query("SELECT * FROM customers WHERE id=$1", [id]);
  if (!rows[0]) throw notFound("Customer not found");
  const customer = mapCustomer(rows[0]);
  customer.contacts = await listCustomerContacts(id);
  customer.history = await customerHistory(customer);
  return customer;
}

export async function createCustomer(body) {
  validateCustomer(body);
  const id = body.id || uid("cust");
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO customers (id,name,billing_address,shipping_address,contact_person,contact_number,email,gstin,state,state_code,pan,customer_type,legal_name,designation,alternate_phone,country,pin_code,notes,active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [id, body.name, body.billingAddress, body.shippingAddress || "", body.contactPerson || "", body.contactNumber || "",
        body.email || "", String(body.gstin || "").toUpperCase(), body.state || "Maharashtra", body.stateCode || "27",
        body.pan || "", body.customerType || body.type || "Sales Customer Account", body.legalName || "", body.designation || "",
        body.alternatePhone || "", body.country || "India", body.pinCode || "", body.notes || "", body.active !== false]
    );
    await replaceContacts(client, id, body.contacts, rows[0]);
    await audit("Customer Created", "customer", id, rows[0].name, null, rows[0], "", client);
    return getCustomerWithClient(client, id);
  });
}

export async function updateCustomer(id, body) {
  const old = await getCustomer(id);
  validateCustomer({ ...old, ...body });
  const next = { ...old, ...body };
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE customers SET name=$2,billing_address=$3,shipping_address=$4,contact_person=$5,contact_number=$6,email=$7,gstin=$8,state=$9,state_code=$10,pan=$11,customer_type=$12,legal_name=$13,designation=$14,alternate_phone=$15,country=$16,pin_code=$17,notes=$18,active=$19,updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, next.name, next.billingAddress, next.shippingAddress || "", next.contactPerson || "", next.contactNumber || "",
        next.email || "", String(next.gstin || "").toUpperCase(), next.state || "Maharashtra", next.stateCode || "27",
        next.pan || "", next.customerType || next.type || "Sales Customer Account", next.legalName || "", next.designation || "",
        next.alternatePhone || "", next.country || "India", next.pinCode || "", next.notes || "", next.active !== false]
    );
    await replaceContacts(client, id, next.contacts, rows[0]);
    await syncCustomerSnapshots(client, id, rows[0]);
    await audit("Customer Updated", "customer", id, rows[0].name, old, rows[0], "", client);
    return getCustomerWithClient(client, id);
  });
}

export async function deactivateCustomer(id) {
  const old = await getCustomer(id);
  const { rows } = await query("UPDATE customers SET active=false, updated_at=now() WHERE id=$1 RETURNING *", [id]);
  await audit("Customer Deactivated", "customer", id, rows[0].name, old, rows[0]);
  return mapCustomer(rows[0]);
}

export async function deleteCustomerPermanently(id) {
  const old = await getCustomer(id);
  return withTransaction(async (client) => {
    await client.query("UPDATE invoices SET customer_id=NULL, updated_at=now() WHERE customer_id=$1", [id]);
    await client.query("UPDATE quotations SET customer_id=NULL, updated_at=now() WHERE customer_id=$1", [id]);
    await client.query("DELETE FROM customer_contacts WHERE customer_id=$1", [id]);
    const { rowCount } = await client.query("DELETE FROM customers WHERE id=$1", [id]);
    if (!rowCount) throw notFound("Customer not found");
    await audit("Customer Permanently Deleted", "customer", id, old.name, old, null, "Permanent delete requested from customer management", client);
    return { deleted: true, id };
  });
}

async function getCustomerWithClient(client, id) {
  const { rows } = await client.query("SELECT * FROM customers WHERE id=$1", [id]);
  const customer = mapCustomer(rows[0]);
  customer.contacts = await listCustomerContacts(id, client);
  customer.history = await customerHistory(customer, client);
  return customer;
}

async function listCustomerContacts(customerId, client = null) {
  const runner = client || { query };
  const { rows } = await runner.query("SELECT * FROM customer_contacts WHERE customer_id=$1 ORDER BY is_primary DESC, name", [customerId]);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    designation: row.designation || "",
    email: row.email || "",
    phone: row.phone || "",
    isPrimary: row.is_primary
  }));
}

async function replaceContacts(client, customerId, contacts = [], customerRow = {}) {
  await client.query("DELETE FROM customer_contacts WHERE customer_id=$1", [customerId]);
  const normalized = Array.isArray(contacts) ? contacts.filter(contact => String(contact.name || "").trim()) : [];
  const fallback = customerRow.contact_person ? [{
    name: customerRow.contact_person,
    designation: customerRow.designation || "",
    email: customerRow.email || "",
    phone: customerRow.contact_number || "",
    isPrimary: true
  }] : [];
  for (const contact of (normalized.length ? normalized : fallback)) {
    await client.query(
      `INSERT INTO customer_contacts (id,customer_id,name,designation,email,phone,is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [contact.id || uid("ctc"), customerId, contact.name, contact.designation || "", contact.email || "", contact.phone || "", contact.isPrimary === true]
    );
  }
}

async function syncCustomerSnapshots(client, customerId, row) {
  await client.query(
    `UPDATE invoices SET
      client_name=$2,
      client_address=$3,
      shipping_address=$4,
      contact_person=$5,
      client_contact=$6,
      client_email=$7,
      client_gstin=$8,
      client_state=$9,
      client_state_code=$10,
      updated_at=now()
     WHERE customer_id=$1 AND deleted_at IS NULL`,
    [customerId, row.name, row.billing_address, row.shipping_address || "", row.contact_person || "", row.contact_number || "",
      row.email || "", String(row.gstin || "").toUpperCase(), row.state || "", row.state_code || ""]
  );
  await client.query(
    `UPDATE quotations SET
      client_name=$2,
      client_address=$3,
      client_contact=$4,
      client_email=$5,
      client_gstin=$6,
      client_state=$7,
      client_state_code=$8,
      updated_at=now()
     WHERE customer_id=$1 AND deleted_at IS NULL`,
    [customerId, row.name, row.billing_address, row.contact_number || "", row.email || "", String(row.gstin || "").toUpperCase(),
      row.state || "", row.state_code || ""]
  );
}

async function customerHistory(customer, client = null) {
  const runner = client || { query };
  const params = [customer.id, customer.name, customer.gstin || ""];
  const { rows: invoices } = await runner.query(
    `SELECT COUNT(*)::int AS total_invoices,
      COALESCE(SUM(grand_total_cents),0)::bigint AS invoice_value_cents,
      COALESCE(SUM(CASE WHEN payment_status='Paid' THEN grand_total_cents ELSE 0 END),0)::bigint AS paid_cents,
      COALESCE(SUM(CASE WHEN payment_status <> 'Paid' AND invoice_status <> 'Cancelled' THEN grand_total_cents ELSE 0 END),0)::bigint AS outstanding_cents
     FROM invoices
     WHERE deleted_at IS NULL AND (customer_id=$1 OR lower(client_name)=lower($2) OR ($3 <> '' AND upper(client_gstin)=upper($3)))`,
    params
  );
  const { rows: quotations } = await runner.query(
    `SELECT COUNT(*)::int AS total_quotations,
      COUNT(*) FILTER (WHERE quotation_status='Accepted')::int AS accepted_quotations,
      COUNT(*) FILTER (WHERE quotation_status='Cancelled')::int AS cancelled_quotations
     FROM quotations
     WHERE deleted_at IS NULL AND (customer_id=$1 OR lower(client_name)=lower($2) OR ($3 <> '' AND upper(client_gstin)=upper($3)))`,
    params
  );
  return { ...invoices[0], ...quotations[0] };
}

function validateCustomer(body) {
  requireFields(body, ["name", "billingAddress"]);
  if (!validateGstin(body.gstin)) throw badRequest("Invalid GSTIN format");
  if (!validateEmail(body.email)) throw badRequest("Invalid email format");
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

export function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    billingAddress: row.billing_address,
    shippingAddress: row.shipping_address || "",
    contactPerson: row.contact_person || "",
    contactNumber: row.contact_number || "",
    email: row.email || "",
    gstin: row.gstin || "",
    state: row.state,
    stateCode: row.state_code,
    pan: row.pan || "",
    customerType: row.customer_type || "Sales Customer Account",
    legalName: row.legal_name || "",
    designation: row.designation || "",
    alternatePhone: row.alternate_phone || "",
    country: row.country || "India",
    pinCode: row.pin_code || "",
    notes: row.notes || "",
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
