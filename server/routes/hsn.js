import express from "express";
import { createHsn, deactivateHsn, getHsn, listHsn, updateHsn } from "../services/hsnService.js";

export const hsnRouter = express.Router();

hsnRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await listHsn(req.query.search || "") }); } catch (error) { next(error); }
});
hsnRouter.get("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await getHsn(req.params.id) }); } catch (error) { next(error); }
});
hsnRouter.post("/", async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createHsn(req.body) }); } catch (error) { next(error); }
});
hsnRouter.put("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await updateHsn(req.params.id, req.body) }); } catch (error) { next(error); }
});
hsnRouter.delete("/:id", async (req, res, next) => {
  try { res.json({ success: true, data: await deactivateHsn(req.params.id) }); } catch (error) { next(error); }
});
