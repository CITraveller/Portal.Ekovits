import express from "express";
import {
  cancelQuotation,
  createQuotation,
  deleteQuotation,
  duplicateQuotation,
  getQuotation,
  listQuotations,
  previewNextQuotationNumber,
  updateQuotation
} from "../services/quotationService.js";

export const quotationsRouter = express.Router();

quotationsRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await listQuotations(req.query.search || "", req.query) }); } catch (error) { next(error); }
});
quotationsRouter.post("/next-number", async (req, res, next) => {
  try { res.json({ success: true, data: await previewNextQuotationNumber() }); } catch (error) { next(error); }
});
quotationsRouter.get("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await getQuotation(req.params.id) }); } catch (error) { next(error); }
});
quotationsRouter.post("/", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createQuotation(req.body, req.user) }); } catch (error) { next(error); }
});
quotationsRouter.put("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await updateQuotation(req.params.id, req.body, req.user) }); } catch (error) { next(error); }
});
quotationsRouter.delete("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await deleteQuotation(req.params.id, req.body.reason || "", req.user) }); } catch (error) { next(error); }
});
quotationsRouter.post("/:id/duplicate", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await duplicateQuotation(req.params.id, req.user) }); } catch (error) { next(error); }
});
quotationsRouter.post("/:id/cancel", async (req, res, next) => {
  try { res.json({ success: true, data: await cancelQuotation(req.params.id, req.body.reason, req.user) }); } catch (error) { next(error); }
});
