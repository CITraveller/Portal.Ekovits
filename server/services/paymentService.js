import { query, withTransaction } from "../db/connection.js";
import { uid } from "../utils/ids.js";
import { toCents } from "../utils/money.js";
import { badRequest } from "../utils/validation.js";
import { audit } from "./auditService.js";
import { refreshPaymentStatus } from "./invoiceService.js";

export async function listPayments() {
  const { rows } = await query(
    `SELECT p.*, i.invoice_no, i.client_name, i.grand_total_cents
     FROM payments p JOIN invoices i ON i.id=p.invoice_id ORDER BY p.created_at DESC`
  );
  return rows.map(mapPayment);
}

export async function createPayment(body) {
  if (!body.invoiceId) throw badRequest("invoiceId is required");
  const amountCents = toCents(body.amount ?? body.amountCents);
  if (amountCents <= 0) throw badRequest("Payment amount must be greater than zero");
  return withTransaction(async (client) => {
    const { rows: totals } = await client.query(
      `SELECT i.*, COALESCE(SUM(p.amount_cents),0)::bigint AS paid
       FROM invoices i LEFT JOIN payments p ON p.invoice_id=i.id WHERE i.id=$1 GROUP BY i.id FOR UPDATE OF i`,
      [body.invoiceId]
    );
    if (!totals[0]) throw badRequest("Invoice not found");
    if (Number(totals[0].paid) + amountCents > Number(totals[0].grand_total_cents)) throw badRequest("Payment exceeds invoice balance");
    const id = body.id || uid("pay");
    const { rows } = await client.query(
      `INSERT INTO payments (id,invoice_id,payment_date,amount_cents,payment_mode,reference,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, body.invoiceId, body.paymentDate || null, amountCents, body.paymentMode || "", body.reference || "", body.notes || ""]
    );
    await refreshPaymentStatus(client, body.invoiceId);
    await audit("Payment Added", "payment", id, `Payment for invoice ${totals[0].invoice_no}`, null, rows[0], "", client, totals[0].invoice_no);
    return mapPayment({ ...rows[0], invoice_no: totals[0].invoice_no, client_name: totals[0].client_name, grand_total_cents: totals[0].grand_total_cents });
  });
}

export async function updatePayment(id, body) {
  const amountCents = toCents(body.amount ?? body.amountCents);
  if (amountCents <= 0) throw badRequest("Payment amount must be greater than zero");
  return withTransaction(async (client) => {
    const { rows: oldRows } = await client.query("SELECT * FROM payments WHERE id=$1", [id]);
    if (!oldRows[0]) throw badRequest("Payment not found");
    const old = oldRows[0];
    const { rows } = await client.query(
      `UPDATE payments SET payment_date=$2,amount_cents=$3,payment_mode=$4,reference=$5,notes=$6,updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, body.paymentDate || null, amountCents, body.paymentMode || "", body.reference || "", body.notes || ""]
    );
    await refreshPaymentStatus(client, old.invoice_id);
    await audit("Payment Updated", "payment", id, "Payment updated", old, rows[0], "", client);
    return rows[0];
  });
}

export async function deletePayment(id) {
  return withTransaction(async (client) => {
    const { rows } = await client.query("DELETE FROM payments WHERE id=$1 RETURNING *", [id]);
    if (!rows[0]) throw badRequest("Payment not found");
    await refreshPaymentStatus(client, rows[0].invoice_id);
    await audit("Payment Deleted", "payment", id, "Payment deleted", rows[0], null, "", client);
    return { deleted: true };
  });
}

function mapPayment(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNo: row.invoice_no,
    clientName: row.client_name,
    grandTotalCents: Number(row.grand_total_cents || 0),
    paymentDate: row.payment_date,
    amountCents: Number(row.amount_cents),
    amount: Number(row.amount_cents) / 100,
    paymentMode: row.payment_mode || "",
    reference: row.reference || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
