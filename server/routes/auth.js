import express from "express";
import { clearSessionCookie, loginEmployee, mapSession, readSessionFromRequest, sessionCookie } from "../services/authService.js";

export const authRouter = express.Router();

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
