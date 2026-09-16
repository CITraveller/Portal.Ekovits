# EKOVITS Invoice & GST Manager

Production-style full-stack migration of the legacy offline invoice generator.

## Requirements

- Node.js 18+
- npm
- PostgreSQL running locally on port `5432`

## Setup

```powershell
npm install
npm run install:all
Copy-Item server\.env.example server\.env
Copy-Item frontend\.env.example frontend\.env
```

Edit `server/.env` and set your PostgreSQL password.

Your local PostgreSQL configuration uses password authentication for `127.0.0.1`, so `DB_PASSWORD` must match the password for `DB_USER`.

## Database

```powershell
createdb -U postgres ekovits_invoice
npm run db:setup --prefix server
npm run import:legacy --prefix server
```

You can also run the database setup from the root:

```powershell
npm run db:setup
```

## Run

```powershell
npm run dev
```

- Frontend: `http://127.0.0.1:5173`
- Backend health check: `http://localhost:5000/api/health`

## Data Flow

```text
React -> Express REST API -> PostgreSQL
```

The app no longer uses localStorage or IndexedDB as the primary database.

## Legacy Data

The original static app and Excel files are preserved in `legacy-data/`. The importer uses `legacy-data/EKOVITS_Invoice_Database.xlsx` as the preferred full legacy source workbook.

## Useful Commands

```powershell
npm run build --prefix frontend
npm run test --prefix server
npm run import:legacy --prefix server
```

## PostgreSQL Backup

```powershell
pg_dump -U postgres -d ekovits_invoice -f ekovits_invoice_backup.sql
```

## Production Deployment

For deploying this app to a Linux server behind Docker + nginx (the pattern used for `portal.ekovits.com`), see [`DEPLOYMENT.md`](./DEPLOYMENT.md).
