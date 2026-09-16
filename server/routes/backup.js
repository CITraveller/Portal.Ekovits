import express from "express";
import { exportWorkbookBuffer, jsonBackup, restoreJson } from "../services/backupService.js";

export const backupRouter = express.Router();

backupRouter.get("/json", async (req, res, next) => {
  try { res.json({ success: true, data: await jsonBackup() }); } catch (error) { next(error); }
});
backupRouter.post("/restore-json", async (req, res, next) => {
  try { res.json({ success: true, data: await restoreJson(req.body) }); } catch (error) { next(error); }
});
backupRouter.get("/excel", async (req, res, next) => {
  try {
    const buffer = await exportWorkbookBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=EKOVITS_Invoice_Database.xlsx");
    res.send(buffer);
  } catch (error) { next(error); }
});
