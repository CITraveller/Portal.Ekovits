import { query } from "../db/connection.js";

function rangeClause(range) {
  if (range === "today") return "invoice_date = CURRENT_DATE";
  if (range === "week") return "invoice_date >= CURRENT_DATE - INTERVAL '7 days'";
  if (range === "month") return "date_trunc('month', invoice_date) = date_trunc('month', CURRENT_DATE)";
  if (range === "fy") return "invoice_date >= make_date(CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN EXTRACT(YEAR FROM CURRENT_DATE)::int ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int - 1 END, 4, 1) AND invoice_date < make_date(CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN EXTRACT(YEAR FROM CURRENT_DATE)::int + 1 ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int END, 4, 1)";
  return "true";
}

export async function dashboard(range = "month") {
  const where = rangeClause(range);
  const activeWhere = `deleted_at IS NULL AND ${where}`;
  const { rows: metrics } = await query(
    `SELECT
      COALESCE(SUM(taxable_cents) FILTER (WHERE invoice_status <> 'Cancelled'),0)::bigint AS taxable_cents,
      COALESCE(SUM(total_gst_cents) FILTER (WHERE invoice_status <> 'Cancelled'),0)::bigint AS gst_cents,
      COALESCE(SUM(grand_total_cents) FILTER (WHERE invoice_status <> 'Cancelled'),0)::bigint AS sales_cents,
      COUNT(*) FILTER (WHERE invoice_status <> 'Cancelled')::int AS invoice_count,
      COUNT(*) FILTER (WHERE invoice_status = 'Draft')::int AS draft_count,
      COUNT(*) FILTER (WHERE invoice_status = 'Cancelled')::int AS cancelled_count
     FROM invoices WHERE ${activeWhere}`
  );
  const { rows: paidRows } = await query(
    `SELECT COALESCE(SUM(p.amount_cents),0)::bigint AS paid_cents
     FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.deleted_at IS NULL AND i.invoice_status <> 'Cancelled' AND ${where.replaceAll("invoice_date", "i.invoice_date")}`
  );
  const { rows: recent } = await query(
    `SELECT invoice_no, client_name, grand_total_cents, payment_status, invoice_status, invoice_date
     FROM invoices WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 8`
  );
  const m = metrics[0];
  const paidCents = Number(paidRows[0].paid_cents || 0);
  const salesCents = Number(m.sales_cents || 0);
  return {
    taxableCents: Number(m.taxable_cents || 0),
    gstCents: Number(m.gst_cents || 0),
    salesCents,
    paidCents,
    outstandingCents: Math.max(0, salesCents - paidCents),
    invoiceCount: Number(m.invoice_count || 0),
    draftCount: Number(m.draft_count || 0),
    cancelledCount: Number(m.cancelled_count || 0),
    recentInvoices: recent
  };
}

export async function gstSummary() {
  const { rows } = await query(
    `SELECT COALESCE(SUM(taxable_cents),0)::bigint taxable_cents,
      COALESCE(SUM(cgst_cents),0)::bigint cgst_cents,
      COALESCE(SUM(sgst_cents),0)::bigint sgst_cents,
      COALESCE(SUM(igst_cents),0)::bigint igst_cents,
      COALESCE(SUM(total_gst_cents),0)::bigint total_gst_cents
     FROM invoices WHERE deleted_at IS NULL AND invoice_status <> 'Cancelled'`
  );
  return rows[0];
}

export async function hsnSummary() {
  const { rows } = await query(
    `SELECT it.hsn, COUNT(DISTINCT i.id)::int AS invoices,
      COALESCE(SUM(it.taxable_cents),0)::bigint AS taxable_cents,
      COALESCE(SUM(CASE WHEN i.gst_type='intra' THEN round(it.taxable_cents * it.gst_rate / 100.0) ELSE round(it.taxable_cents * it.gst_rate / 100.0) END),0)::bigint AS gst_cents
     FROM invoice_items it JOIN invoices i ON i.id=it.invoice_id
     WHERE i.deleted_at IS NULL AND i.invoice_status <> 'Cancelled'
     GROUP BY it.hsn ORDER BY it.hsn`
  );
  return rows.map(r => ({ ...r, invoice_value_cents: Number(r.taxable_cents) + Number(r.gst_cents) }));
}

export async function customerSummary() {
  const { rows } = await query(
    `SELECT client_name, COUNT(*)::int invoices, COALESCE(SUM(taxable_cents),0)::bigint taxable_cents, COALESCE(SUM(grand_total_cents),0)::bigint invoice_value_cents
     FROM invoices WHERE deleted_at IS NULL AND invoice_status <> 'Cancelled' GROUP BY client_name ORDER BY invoice_value_cents DESC`
  );
  return rows;
}

export async function monthlySummary() {
  const { rows } = await query(
    `SELECT to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS month, COUNT(*)::int invoices,
      COALESCE(SUM(taxable_cents),0)::bigint taxable_cents, COALESCE(SUM(grand_total_cents),0)::bigint invoice_value_cents
     FROM invoices WHERE deleted_at IS NULL AND invoice_status <> 'Cancelled' GROUP BY 1 ORDER BY 1`
  );
  return rows;
}
