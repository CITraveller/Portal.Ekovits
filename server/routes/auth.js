import express from "express";
import { clearSessionCookie, loginEmployee, mapSession, readSessionFromRequest, sessionCookie } from "../services/authService.js";
import { getSettings } from "../services/settingsService.js";

export const authRouter = express.Router();

authRouter.get("/branding", async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({
      success: true,
      data: {
        name: settings.name,
        email: settings.email,
        website: settings.website,
        logoPath: settings.logoPath
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/session", (req, res) => {
  const session = readSessionFromRequest(req);
  res.json({ success: true, data: session ? mapSession(session) : null });
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { token, user } = await loginEmployee(req.body.email, req.body.password);
    res.setHeader("Set-Cookie", sessionCookie(token));
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ success: true, data: { loggedOut: true } });
});
