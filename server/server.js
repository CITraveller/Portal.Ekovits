import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { env } from "./config/env.js";
import { pool } from "./db/connection.js";
import { customersRouter } from "./routes/customers.js";
import { hsnRouter } from "./routes/hsn.js";
import { invoicesRouter } from "./routes/invoices.js";
import { paymentsRouter } from "./routes/payments.js";
import { settingsRouter } from "./routes/settings.js";
import { reportsRouter } from "./routes/reports.js";
import { auditRouter } from "./routes/audit.js";
import { backupRouter } from "./routes/backup.js";
import { authRouter } from "./routes/auth.js";
import { quotationsRouter } from "./routes/quotations.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { verifySchema } from "./db/init.js";
import { applyMigrations } from "./db/migrations.js";

fs.mkdirSync(env.uploadDir, { recursive: true });

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = new Set([
  env.clientUrl,
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));
app.use("/uploads/_private", (req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use("/uploads", express.static(path.resolve(env.uploadDir)));
app.use("/api/auth", authRouter);

app.get("/api/health", async (req, res, next) => {
  try {
    const db = await pool.query("SELECT now() AS now");
    const schema = await verifySchema();
    res.status(schema.ready ? 200 : 503).json({
      success: schema.ready,
      data: {
        status: schema.ready ? "ok" : "schema_missing",
        database: "connected",
        databaseTime: db.rows[0].now,
        missingTables: schema.missing
      },
      message: schema.ready ? undefined : "PostgreSQL is connected, but database tables are missing. Run npm run db:setup --prefix server."
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "PostgreSQL connection failed. Check server/.env and run npm run db:setup --prefix server.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
});
app.use("/api", requireAuth);
app.use("/api/customers", customersRouter);
app.use("/api/hsn", hsnRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/backup", backupRouter);
app.use("/api/quotations", quotationsRouter);
app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await applyMigrations();
    const schema = await verifySchema();
    if (!schema.ready) {
      throw new Error(`Database schema is incomplete. Missing tables: ${schema.missing.join(", ")}`);
    }
    app.listen(env.port, () => {
      console.log(`EKOVITS API listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("EKOVITS API startup failed:");
    console.error(error);
    process.exit(1);
  }
}

startServer();
