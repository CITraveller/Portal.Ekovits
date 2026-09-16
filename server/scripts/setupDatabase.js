import { ensureDatabase, applySchemaAndSeed, verifySchema } from "../db/init.js";
import { pool } from "../db/connection.js";
import { env } from "../config/env.js";

async function main() {
  console.log(`Setting up PostgreSQL database "${env.db.database}" on ${env.db.host}:${env.db.port} as ${env.db.user}`);
  if (!env.db.password) {
    console.log("DB_PASSWORD is blank. Your PostgreSQL pg_hba.conf uses scram-sha-256, so set DB_PASSWORD in server/.env if setup fails.");
  }
  await ensureDatabase();
  await applySchemaAndSeed();
  const schema = await verifySchema();
  if (!schema.ready) {
    throw new Error(`Schema setup incomplete. Missing tables: ${schema.missing.join(", ")}`);
  }
  console.log("Database ready.");
}

main()
  .catch((error) => {
    console.error("Database setup failed:");
    console.error(error.message);
    if (String(error.message).includes("SASL") || String(error.message).includes("password")) {
      console.error("Fix: copy server/.env.example to server/.env and set DB_PASSWORD to your local PostgreSQL postgres user password.");
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
