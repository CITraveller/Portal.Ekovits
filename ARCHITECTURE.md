# EKOVITS Full-Stack Architecture

The migrated application is split into a React frontend, an Express API, and PostgreSQL as the source of truth.

```text
client React/Vite
  -> REST JSON API
server Node/Express
  -> pg parameterized queries and transactions
PostgreSQL
```

## Preserved Legacy Behavior

- Dashboard, invoice form, invoice history, customers, HSN/SAC, payments, reports, settings, backup, and audit screens are represented in React.
- GST totals are calculated with paise/cents integer arithmetic.
- Invoice create/update runs through the backend, not localStorage or IndexedDB.
- Invoice numbers are generated under a database row lock from `company_settings.next_invoice_number`.
- Legacy `.xlsx` and static source files are retained in `legacy-data/` for import and auditability.

## Key Runtime Ports

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- PostgreSQL: `localhost:5432`
