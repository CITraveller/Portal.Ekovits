import express from "express";
import { cancelInvoice, createInvoice, deleteInvoice, duplicateInvoice, getInvoice, listInvoices, previewNextInvoiceNumber, updateInvoice } from "../services/invoiceService.js";

export const invoicesRouter = express.Router();

invoicesRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await listInvoices(req.query.search || "") }); } catch (error) { next(error); }
});
invoicesRouter.post("/next-number", async (req, res, next) => {
  try { res.json({ success: true, data: await previewNextInvoiceNumber() }); } catch (error) { next(error); }
});
invoicesRouter.get("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await getInvoice(req.params.id) }); } catch (error) { next(error); }
});
invoicesRouter.post("/", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createInvoice(req.body) }); } catch (error) { next(error); }
});
invoicesRouter.put("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await updateInvoice(req.params.id, req.body) }); } catch (error) { next(error); }
});
invoicesRouter.delete("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await deleteInvoice(req.params.id, req.body.reason || "") }); } catch (error) { next(error); }
});
invoicesRouter.post("/:id/duplicate", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await duplicateInvoice(req.params.id) }); } catch (error) { next(error); }
});
invoicesRouter.post("/:id/cancel", async (req, res, next) => {
  try { res.json({ success: true, data: await cancelInvoice(req.params.id, req.body.reason) }); } catch (error) { next(error); }
});
