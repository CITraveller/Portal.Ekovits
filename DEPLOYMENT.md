# Deploying to portal.ekovits.com

This mirrors the pattern already used for your other apps on this box
(`ekovits-frontend`/`ekovits-backend`, `citraveller_frontend`/`citraveller_backend`,
etc.): one container for the API, one for the static frontend behind nginx,
one for Postgres, wired together with docker-compose, then reverse-proxied
by the host's nginx under a real domain with TLS.

Ports already in use on the box (from `docker ps`): `3001-3004` and
`5001-5004`. This guide uses the next free pair, **3005** (frontend) and
**5005** (backend), and a dedicated Postgres container so this app's data is
fully isolated from `ekovits-postgres`/`citraveller_db`/etc.

## 0. What you'll end up with

| Container         | Image             | Port (host, localhost-only) |
|--------------------|-------------------|------------------------------|
| `portal_db`         | postgres:16-alpine| (internal only, not exposed) |
| `portal_backend`    | built from `server/` | 127.0.0.1:5005 → 5000     |
| `portal_frontend`   | built from `frontend/` (nginx) | 127.0.0.1:3005 → 80 |

Host nginx terminates TLS for `portal.ekovits.com` and proxies:
- `/api/*` and `/uploads/*` → `127.0.0.1:5005` (backend)
- everything else → `127.0.0.1:3005` (frontend)

## 1. Copy the project to the server

```bash
# from your machine
scp -r "Invoice Generator" ubuntu@<server>:~/Portal.ekovits.com

# or on the server, if you push this to GitHub/GitLab instead:
cd ~
git clone <your-repo-url> Portal.ekovits.com
```

`node_modules` is intentionally **not** included — it gets installed inside
the Docker build, not on the host.

## 2. Set the database password

```bash
cd ~/Portal.ekovits.com
cp .env.production.example .env
nano .env          # set DB_PASSWORD to a strong, unique password
```

This `.env` is read automatically by `docker compose` for the
`${DB_PASSWORD}` placeholders in `docker-compose.yml`. It is already covered
by `.gitignore` — never commit it.

## 3. Build and start the containers

```bash
cd ~/Portal.ekovits.com
docker compose build
docker compose up -d
docker compose ps
```

You should see `portal_db`, `portal_backend`, `portal_frontend` all `Up`
(portal_db will show `(healthy)` once Postgres is ready).

## 4. Initialize the database schema

The database container starts empty (just the `ekovits_invoice` database
itself, created by `POSTGRES_DB`). Apply the schema and seed once:

```bash
docker compose exec portal_backend node scripts/setupDatabase.js
```

Expected output ends with `Database ready.`

### If you have real historical invoices to bring in

If `legacy-data/EKOVITS_Invoice_Database.xlsx` contains your actual past
customers/invoices/payments (not just sample data), import it **after**
`setupDatabase.js`, from inside the backend container so it can reach
`portal_db`:

```bash
docker cp "legacy-data/EKOVITS_Invoice_Database.xlsx" portal_backend:/app/legacy.xlsx
docker compose exec portal_backend node scripts/importExcelData.js /app/legacy.xlsx
```

This import script now automatically advances `next_invoice_number` past the
highest invoice number it finds in your real history, so newly created
invoices can't collide with ones you've already issued (this was previously
a bug — see note below).

Once you've confirmed the import succeeded (check `/api/health` and browse
Invoices in the app), it's fine to delete the legacy `.xlsx` files from the
server — they're not needed at runtime, only for that one-time migration.

## 5. Verify the API directly

```bash
curl http://127.0.0.1:5005/api/health
```

Should return `{"success":true,"data":{"status":"ok", ...}}`.

## 6. Host nginx (reverse proxy + TLS)

Create `/etc/nginx/sites-available/portal.ekovits.com`:

```nginx
server {
    listen 80;
    server_name portal.ekovits.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.ekovits.com;

    ssl_certificate     /etc/letsencrypt/live/portal.ekovits.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.ekovits.com/privkey.pem;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:5005/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5005/uploads/;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/portal.ekovits.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d portal.ekovits.com    # issues/renews the TLS cert
sudo systemctl reload nginx
```

Point `portal.ekovits.com`'s DNS A record at this server's IP if that isn't
done already — certbot's `--nginx` flow needs it resolving correctly first.

## 7. Point DNS

Add an `A` record: `portal.ekovits.com` → this server's public IP (same IP
your other `*.ekovits.com` subdomains resolve to).

## 8. Smoke test

```bash
curl -I https://portal.ekovits.com
curl https://portal.ekovits.com/api/health
```

Then open `https://portal.ekovits.com` in a browser, go to Settings and
confirm the company details/bank details are correct, create a test draft
invoice, and use **Print / Save PDF** to confirm the A4 layout looks right.

## Day-2 operations

```bash
# view logs
docker compose logs -f portal_backend
docker compose logs -f portal_frontend

# redeploy after a code change
git pull            # or re-scp the changed files
docker compose build
docker compose up -d

# back up the database
docker compose exec portal_db pg_dump -U portal_app -d ekovits_invoice > backup_$(date +%F).sql

# restore
cat backup_2026-09-14.sql | docker compose exec -T portal_db psql -U portal_app -d ekovits_invoice
```

Uploaded files (logo/stamp/signature) live in the `portal_uploads` named
Docker volume, so they survive container rebuilds. Back that up too if you
want full disaster recovery:

```bash
docker run --rm -v portal_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/portal_uploads_$(date +%F).tar.gz -C /data .
```

## Notes on assumptions made here

- I don't have access to your host-level nginx/certbot setup for the other
  `*.ekovits.com` sites, so the vhost above is a standard template — adapt
  paths/cert names if your existing sites follow a different convention
  (e.g. if you use a shared wildcard cert instead of per-subdomain certbot).
- This gives the invoice app its own dedicated Postgres container
  (`portal_db`) rather than reusing `ekovits-postgres`, so a problem with
  one app's database can't affect the other. If you'd rather consolidate
  onto the existing `ekovits-postgres` container to save resources, that's
  also fine — just create a second database inside it and point
  `portal_backend`'s `DB_HOST`/`DB_NAME` env vars at that instead of running
  `portal_db` at all.
