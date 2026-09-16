import express from "express";
import { listAudit } from "../services/auditService.js";

export const auditRouter = express.Router();

auditRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await listAudit(req.query.search || "") }); } catch (error) { next(error); }
});
