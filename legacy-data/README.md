# EKOVITS Invoice & GST Manager

Internal offline-first invoice and basic GST accounting application for EKOVITS CONSULTING LLP.

## Run

Open `index.html` in Chrome or Edge.

For the most reliable browser storage and print behavior, run a local server from this folder:

```powershell
python -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

For phone access on the same Wi-Fi, start it with `python -m http.server 8765 --bind 0.0.0.0`, find the computer's local IPv4 address, and open `http://<computer-ip>:8765/` on the phone. The responsive layout switches to a single-column form and keeps wide record tables horizontally scrollable.

## What Changed From The Supplied ZIP

The original ZIP contained one `index.html`, three `.xlsx` files, and a README. It already had a basic invoice form, localStorage records, PDF export via CDN scripts, customer/HSN lists, and simple Excel exports.

This refactor replaces the app with a maintainable static structure:

- `index.html`: application screens and dialogs
- `styles.css`: dashboard UI plus dedicated A4 print invoice template
- `app.js`: IndexedDB persistence, GST calculations, invoice lifecycle, audit log, payments, reports, backup/export
- existing `.xlsx` files are preserved as source/reference files

## Data Storage

The primary database is browser IndexedDB. It keeps:

- Company settings
- Customers
- HSN/SAC master
- Invoices and invoice line items
- Payment details
- Audit log

Use `Backup All Data (JSON)` regularly. JSON backup is the full-fidelity restore format. For a live Excel database, open `Backup`, click `Sync Excel Database`, and choose a local folder. The app writes actual `.xlsx` files for `Customers.xlsx`, `HSN_Codes.xlsx`, `Invoice_History.xlsx`, `Company_Settings.xlsx`, `Payments.xlsx`, `GST_Summary.xlsx`, `Audit_Log.xlsx`, and `EKOVITS_Invoice_Database.xlsx`. While that browser tab remains connected, customer, HSN/SAC, company setting, image, payment, and invoice changes update those files automatically. The older `Connect Legacy Excel File` button remains available for the previous single `.xls` workflow.

## Invoice Edit And Update Workflow

Saved invoices can be opened from `Invoices > Edit`.

- Draft invoices can be edited and saved normally.
- Final invoices can also be corrected if a rate or data value was mismatched.
- When a final invoice is edited, the app requires an edit reason.
- Totals are recalculated from the changed data.
- The saved invoice is updated.
- An audit log entry records the old summary, new summary, date/time, and reason.
- Cancelled invoices remain in history and their numbers are not reused.

## GST Calculation

Money is calculated in paise/cents internally and displayed to 2 decimals.

- Same supplier and customer state: CGST + SGST
- Different state: IGST
- Manual GST treatment override is allowed after confirmation
- Amount in words uses Indian numbering terms

Sample verification:

- HSN/SAC: `998713`
- Qty: `1`
- Rate: `5400`
- GST: `18%`
- CGST: `486`
- SGST: `486`
- Grand total: `6372`

## PDF / Print

The invoice preview uses a dedicated A4 HTML print template based on the supplied tax invoice image.

Use `Print / Save PDF` or `Download PDF`, then choose `Save as PDF` in the browser print dialog. Name the file:

```text
TAX INVOICE- 202621.pdf
```

Browser-only print APIs do not allow a static offline page to force the PDF filename. The app shows the correct filename before opening print.

## Excel Export And Import

The app exports:

- Full Excel-compatible workbook: `EKOVITS_INVOICE_DATABASE.xls`
- Customers CSV
- HSN/SAC CSV
- Reports workbook

The exported `.xls` file opens in Excel and contains normalized sheets:

- Company_Settings
- Customers
- HSN_SAC_Master
- Invoices
- Invoice_Items
- Payments
- GST_Summary
- Audit_Log

The GST summary on each invoice is grouped by HSN/SAC and GST rate. When an invoice contains multiple HSN/SAC codes, each group gets its own taxable value, CGST/SGST or IGST amounts, and total tax row in the preview/print output and workbook reports.

Direct offline `.xlsx` parsing/export normally requires a bundled XLSX library. The original app loaded that from a CDN, which is not offline-safe. This version keeps the core app offline and uses JSON as the reliable restore format.

## Recommended Acceptance Checks

1. Add a customer.
2. Reload the browser and confirm the customer remains.
3. Add or confirm HSN/SAC `998713` with GST `18%`.
4. Create invoice `202621` with Qty `1`, Rate `5400`, GST `18%`.
5. Confirm Taxable `₹5,400.00`, CGST `₹486.00`, SGST `₹486.00`, GST `₹972.00`, Grand Total `₹6,372.00`.
6. Preview and print/save PDF.
   - New invoice forms start with no line items; use `Add Line` to enter details.
   - `Reference / PO` and `Terms & Conditions / Notes` are saved with the invoice and printed into the lower-left block beside the bank details.
7. Mark paid and confirm dashboard updates.
8. Mark partially paid and confirm outstanding amount.
9. Cancel invoice and confirm it remains in history.
10. Export JSON and Excel-compatible database.
11. Restore JSON in a fresh browser profile/database.
12. Create another invoice and confirm the invoice number is not duplicated.
