import { applyMigrations } from "../db/migrations.js";
import { verifySchema } from "../db/init.js";
import { pool } from "../db/connection.js";
import { env } from "../config/env.js";

async function main() {
  console.log(`Applying migrations to PostgreSQL database "${env.db.database}" on ${env.db.host}:${env.db.port} as ${env.db.user}`);
  await applyMigrations();
  const schema = await verifySchema();
  if (!schema.ready) {
    throw new Error(`Migration completed, but schema verification is incomplete. Missing tables: ${schema.missing.join(", ")}`);
  }
  console.log("Migrations applied.");
}

main()
  .catch((error) => {
    console.error("Database migration failed:");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
