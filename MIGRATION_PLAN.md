# Migration Plan

## Phase 1: Legacy Analysis

The legacy application was a static browser app with:

- `index.html` for UI screens and templates.
- `app.js` for IndexedDB persistence, GST calculation, invoice lifecycle, Excel export/import, payments, reports, audit log, and print preview.
- `styles.css` for dashboard UI and A4 invoice print styling.
- `.xlsx` files containing company settings, customers, HSN/SAC master, invoices, invoice items, payments, reports, and audit logs.

## Phase 2: Database Migration

1. Create the PostgreSQL database.
2. Apply `database/schema.sql`.
3. Apply `database/seed.sql`.
4. Run `npm run import:legacy --prefix server`.

The importer reads `legacy-data/EKOVITS_Invoice_Database.xlsx`, maps rows into normalized tables, validates records through the same service layer, and reports invalid rows.

## Phase 3: Application Runtime

1. Start the Express API on port `5000`.
2. Start the React/Vite frontend on port `5173`.
3. Use the frontend normally. React calls Express, and Express reads/writes PostgreSQL.

## Phase 4: Verification

Run customer, HSN/SAC, invoice, edit/revision, payment, report, export, and restart checks after PostgreSQL credentials are configured in `server/.env`.
