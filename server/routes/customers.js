import express from "express";
import { createCustomer, deactivateCustomer, deleteCustomerPermanently, getCustomer, listCustomers, updateCustomer } from "../services/customerService.js";

export const customersRouter = express.Router();

customersRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await listCustomers(req.query.search || "") }); } catch (error) { next(error); }
});
customersRouter.get("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await getCustomer(req.params.id) }); } catch (error) { next(error); }
});
customersRouter.post("/", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createCustomer(req.body) }); } catch (error) { next(error); }
});
customersRouter.put("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await updateCustomer(req.params.id, req.body) }); } catch (error) { next(error); }
});
customersRouter.delete("/:id/permanent", async (req, res, next) => {
  try { res.json({ success: true, data: await deleteCustomerPermanently(req.params.id) }); } catch (error) { next(error); }
});
customersRouter.delete("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await deactivateCustomer(req.params.id) }); } catch (error) { next(error); }
});
