import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { databaseConfig, pool } from "./connection.js";
import { env } from "../config/env.js";
import { applyMigrations } from "./migrations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "schema.sql");
const seedPath = path.resolve(__dirname, "seed.sql");

export async function ensureDatabase() {
  const admin = new pg.Client(databaseConfig("postgres"));
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [env.db.database]);
    if (!exists.rowCount) {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(env.db.database)}`);
    }
  } finally {
    await admin.end();
  }
}

export async function applySchemaAndSeed() {
  await pool.query(await fs.readFile(schemaPath, "utf8"));
  await applyMigrations();
  await pool.query(await fs.readFile(seedPath, "utf8"));
}

export async function verifySchema() {
  const required = ["company_settings", "customers", "hsn_codes", "invoices", "invoice_items", "payments", "audit_logs", "invoice_number_sequences", "employees", "quotations", "quotation_items", "quotation_number_sequences"];
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)",
    [required]
  );
  const found = new Set(rows.map(row => row.table_name));
  return {
    ready: required.every(table => found.has(table)),
    missing: required.filter(table => !found.has(table))
  };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
