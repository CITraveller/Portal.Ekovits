import { query } from "../db/connection.js";
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
  return mapCustomer(rows[0]);
}

export async function createCustomer(body) {
  validateCustomer(body);
  const id = body.id || uid("cust");
  const { rows } = await query(
    `INSERT INTO customers (id,name,billing_address,shipping_address,contact_person,contact_number,email,gstin,state,state_code,pan,customer_type,notes,active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [id, body.name, body.billingAddress, body.shippingAddress || "", body.contactPerson || "", body.contactNumber || "",
      body.email || "", String(body.gstin || "").toUpperCase(), body.state || "Maharashtra", body.stateCode || "27",
      body.pan || "", body.customerType || body.type || "Business", body.notes || "", body.active !== false]
  );
  await audit("Customer Created", "customer", id, rows[0].name, null, rows[0]);
  return mapCustomer(rows[0]);
}

export async function updateCustomer(id, body) {
  const old = await getCustomer(id);
  validateCustomer({ ...old, ...body });
  const next = { ...old, ...body };
  const { rows } = await query(
    `UPDATE customers SET name=$2,billing_address=$3,shipping_address=$4,contact_person=$5,contact_number=$6,email=$7,gstin=$8,state=$9,state_code=$10,pan=$11,customer_type=$12,notes=$13,active=$14,updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id, next.name, next.billingAddress, next.shippingAddress || "", next.contactPerson || "", next.contactNumber || "",
      next.email || "", String(next.gstin || "").toUpperCase(), next.state || "Maharashtra", next.stateCode || "27",
      next.pan || "", next.customerType || next.type || "Business", next.notes || "", next.active !== false]
  );
  await audit("Customer Updated", "customer", id, rows[0].name, old, rows[0]);
  return mapCustomer(rows[0]);
}

export async function deactivateCustomer(id) {
  const old = await getCustomer(id);
  const { rows } = await query("UPDATE customers SET active=false, updated_at=now() WHERE id=$1 RETURNING *", [id]);
  await audit("Customer Deactivated", "customer", id, rows[0].name, old, rows[0]);
  return mapCustomer(rows[0]);
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
    customerType: row.customer_type || "Business",
    notes: row.notes || "",
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
