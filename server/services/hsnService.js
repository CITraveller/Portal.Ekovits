import { query } from "../db/connection.js";
import { uid } from "../utils/ids.js";
import { badRequest, requireFields } from "../utils/validation.js";
import { audit } from "./auditService.js";

export async function listHsn(search = "") {
  const params = [];
  let where = "";
  if (search) {
    params.push(`%${search}%`);
    where = "WHERE code ILIKE $1 OR description ILIKE $1";
  }
  const { rows } = await query(`SELECT * FROM hsn_codes ${where} ORDER BY active DESC, code`, params);
  return rows.map(mapHsn);
}

export async function getHsn(id) {
  const { rows } = await query("SELECT * FROM hsn_codes WHERE id=$1", [id]);
  if (!rows[0]) throw notFound("HSN/SAC not found");
  return mapHsn(rows[0]);
}

export async function createHsn(body) {
  validateHsn(body);
  const id = body.id || uid("hsn");
  const { rows } = await query(
    `INSERT INTO hsn_codes (id,code,description,gst_rate,cgst_rate,sgst_rate,igst_rate,unit,notes,active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description,gst_rate=EXCLUDED.gst_rate,cgst_rate=EXCLUDED.cgst_rate,sgst_rate=EXCLUDED.sgst_rate,igst_rate=EXCLUDED.igst_rate,unit=EXCLUDED.unit,notes=EXCLUDED.notes,active=EXCLUDED.active,updated_at=now()
     RETURNING *`,
    [id, body.code, body.description, Number(body.gstRate), Number(body.cgstRate ?? Number(body.gstRate) / 2),
      Number(body.sgstRate ?? Number(body.gstRate) / 2), Number(body.igstRate ?? body.gstRate), body.unit || "No.", body.notes || "", body.active !== false]
  );
  await audit("HSN Created", "hsn", rows[0].id, rows[0].code, null, rows[0]);
  return mapHsn(rows[0]);
}

export async function updateHsn(id, body) {
  const old = await getHsn(id);
  const next = { ...old, ...body };
  validateHsn(next);
  const { rows } = await query(
    `UPDATE hsn_codes SET code=$2,description=$3,gst_rate=$4,cgst_rate=$5,sgst_rate=$6,igst_rate=$7,unit=$8,notes=$9,active=$10,updated_at=now()
     WHERE id=$1 RETURNING *`,
    [id, next.code, next.description, Number(next.gstRate), Number(next.cgstRate), Number(next.sgstRate), Number(next.igstRate), next.unit || "No.", next.notes || "", next.active !== false]
  );
  await audit("HSN Updated", "hsn", id, rows[0].code, old, rows[0]);
  return mapHsn(rows[0]);
}

export async function deactivateHsn(id) {
  const old = await getHsn(id);
  const { rows } = await query("UPDATE hsn_codes SET active=false, updated_at=now() WHERE id=$1 RETURNING *", [id]);
  await audit("HSN Deactivated", "hsn", id, rows[0].code, old, rows[0]);
  return mapHsn(rows[0]);
}

function validateHsn(body) {
  requireFields(body, ["code", "description"]);
  if (Number(body.gstRate) < 0) throw badRequest("GST rate must be zero or greater");
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

export function mapHsn(row) {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    gstRate: Number(row.gst_rate),
    cgstRate: Number(row.cgst_rate),
    sgstRate: Number(row.sgst_rate),
    igstRate: Number(row.igst_rate),
    unit: row.unit || "No.",
    notes: row.notes || "",
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
