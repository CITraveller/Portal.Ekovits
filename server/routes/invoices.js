import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { env } from "../config/env.js";
import { attachOriginalDocument, cancelInvoice, createInvoice, deleteInvoice, duplicateInvoice, getInvoice, getOriginalDocument, listInvoices, previewNextInvoiceNumber, updateInvoice, updateInvoiceGstPaidStatus, updateInvoicePaymentStatus } from "../services/invoiceService.js";
import { commitInvoiceImport, importTemplateBuffer, previewInvoiceImport } from "../services/invoiceImportService.js";

export const invoicesRouter = express.Router();
const originalDocumentDir = path.join(env.uploadDir, "_private", "invoice-originals");
fs.mkdirSync(originalDocumentDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: originalDocumentDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, file.mimetype === "application/pdf");
  }
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

invoicesRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await listInvoices(req.query.search || "", req.query) }); } catch (error) { next(error); }
});
invoicesRouter.get("/import/template", async (req, res, next) => {
  try {
    const buffer = importTemplateBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=historical-invoice-import-template.xlsx");
    res.send(buffer);
  } catch (error) { next(error); }
});
invoicesRouter.post("/import/preview", importUpload.single("file"), async (req, res, next) => {
  try { res.json({ success: true, data: await previewInvoiceImport(req.file) }); } catch (error) { next(error); }
});
invoicesRouter.post("/import/commit", importUpload.single("file"), async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await commitInvoiceImport(req.file, req.user) }); } catch (error) { next(error); }
});
invoicesRouter.post("/next-number", async (req, res, next) => {
  try { res.json({ success: true, data: await previewNextInvoiceNumber() }); } catch (error) { next(error); }
});
invoicesRouter.get("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await getInvoice(req.params.id) }); } catch (error) { next(error); }
});
invoicesRouter.post("/", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createInvoice(req.body, req.user) }); } catch (error) { next(error); }
});
invoicesRouter.put("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await updateInvoice(req.params.id, req.body, req.user) }); } catch (error) { next(error); }
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
invoicesRouter.post("/:id/payment-status", async (req, res, next) => {
  try { res.json({ success: true, data: await updateInvoicePaymentStatus(req.params.id, req.body.paymentStatus, req.user) }); } catch (error) { next(error); }
});
invoicesRouter.post("/:id/gst-status", async (req, res, next) => {
  try { res.json({ success: true, data: await updateInvoiceGstPaidStatus(req.params.id, req.body.gstPaid, req.user) }); } catch (error) { next(error); }
});
invoicesRouter.post("/:id/original-document", upload.single("document"), async (req, res, next) => {
  try { res.json({ success: true, data: await attachOriginalDocument(req.params.id, req.file, req.user) }); } catch (error) { next(error); }
});
invoicesRouter.get("/:id/original-document", async (req, res, next) => {
  try {
    const document = await getOriginalDocument(req.params.id);
    res.download(document.absolute, document.filename);
  } catch (error) { next(error); }
});
