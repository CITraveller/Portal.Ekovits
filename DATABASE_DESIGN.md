# Database Design

The canonical schema is [database/schema.sql](database/schema.sql).

## Tables

- `company_settings`: company identity, GSTIN, bank details, invoice sequence, and uploaded asset paths.
- `customers`: active/inactive customer master data.
- `hsn_codes`: HSN/SAC master records and GST rates.
- `invoices`: invoice headers, customer snapshot fields, company snapshot JSON, totals, status, revision, and payment status.
- `invoice_items`: one-to-many line items with HSN/SAC, quantity, rate, GST rate, and taxable value.
- `payments`: one-to-many payment records linked to invoices.
- `audit_logs`: entity-level audit trail with JSONB old/new values.

## Integrity

- Invoice numbers are unique.
- Invoice items and payments cascade with invoices.
- Invoice totals are stored in integer paise/cents fields.
- Quantities, rates, and GST rates use checks to reject invalid negative values.
- Customer and company snapshots are retained on invoices so historical invoices do not drift when master data changes.
