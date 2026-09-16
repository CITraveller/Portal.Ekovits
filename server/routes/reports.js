import express from "express";
import { customerSummary, dashboard, gstSummary, hsnSummary, monthlySummary } from "../services/reportService.js";

export const reportsRouter = express.Router();

reportsRouter.get("/dashboard", async (req, res, next) => {
  try { res.json({ success: true, data: await dashboard(req.query.range || "month") }); } catch (error) { next(error); }
});
reportsRouter.get("/gst-summary", async (req, res, next) => {
  try { res.json({ success: true, data: await gstSummary() }); } catch (error) { next(error); }
});
reportsRouter.get("/hsn-summary", async (req, res, next) => {
  try { res.json({ success: true, data: await hsnSummary() }); } catch (error) { next(error); }
});
reportsRouter.get("/customer-summary", async (req, res, next) => {
  try { res.json({ success: true, data: await customerSummary() }); } catch (error) { next(error); }
});
reportsRouter.get("/monthly-summary", async (req, res, next) => {
  try { res.json({ success: true, data: await monthlySummary() }); } catch (error) { next(error); }
});
