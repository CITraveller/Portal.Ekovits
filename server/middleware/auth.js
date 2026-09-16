import { readSessionFromRequest } from "../services/authService.js";

export function requireAuth(req, res, next) {
  const session = readSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Login required" });
  }
  req.user = session;
  next();
}
