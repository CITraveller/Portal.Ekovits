import express from "express";
import { createPayment, deletePayment, listPayments, updatePayment } from "../services/paymentService.js";

export const paymentsRouter = express.Router();

paymentsRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await listPayments() }); } catch (error) { next(error); }
});
paymentsRouter.post("/", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createPayment(req.body) }); } catch (error) { next(error); }
});
paymentsRouter.put("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await updatePayment(req.params.id, req.body) }); } catch (error) { next(error); }
});
paymentsRouter.delete("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await deletePayment(req.params.id) }); } catch (error) { next(error); }
});
