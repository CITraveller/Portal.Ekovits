import express from "express";
import multer from "multer";
import path from "path";
import { env } from "../config/env.js";
import { getSettings, updateSettings } from "../services/settingsService.js";
import { audit } from "../services/auditService.js";

const storage = multer.diskStorage({
  destination: env.uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, /^image\//.test(file.mimetype));
  }
});

export const settingsRouter = express.Router();

settingsRouter.get("/", async (req, res, next) => {
  try { res.json({ success: true, data: await getSettings() }); } catch (error) { next(error); }
});
settingsRouter.put("/", async (req, res, next) => {
  try {
    const old = await getSettings();
    const data = await updateSettings(req.body);
    await audit("Settings Updated", "settings", "company", "Company settings updated", old, data);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
settingsRouter.post("/assets", upload.fields([{ name: "logo" }, { name: "stamp" }, { name: "signature" }]), async (req, res, next) => {
  try {
    const settings = await getSettings();
    const files = req.files || {};
    const data = await updateSettings({
      ...settings,
      logoPath: files.logo?.[0] ? `/uploads/${path.basename(files.logo[0].path)}` : settings.logoPath,
      stampPath: files.stamp?.[0] ? `/uploads/${path.basename(files.stamp[0].path)}` : settings.stampPath,
      signaturePath: files.signature?.[0] ? `/uploads/${path.basename(files.signature[0].path)}` : settings.signaturePath
    });
    await audit("Settings Updated", "settings", "company", "Company assets updated", settings, data);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});
