import crypto from "crypto";
import { query } from "../db/connection.js";
import { env } from "../config/env.js";
import { audit } from "./auditService.js";

const COOKIE_NAME = "ekovits_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export async function loginEmployee(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const { rows } = await query("SELECT * FROM employees WHERE lower(email)=lower($1) AND active=true", [normalizedEmail]);
  const employee = rows[0];
  if (!employee || !verifyPassword(password, employee.password_hash)) {
    await audit("Login Failed", "employee", employee?.id || null, normalizedEmail, null, { email: normalizedEmail });
    const error = new Error("Invalid username or password");
    error.status = 401;
    throw error;
  }
  await query("UPDATE employees SET last_login_at=now(), updated_at=now() WHERE id=$1", [employee.id]);
  await audit("Employee Login", "employee", employee.id, employee.email, null, { email: employee.email, role: employee.role });
  return {
    token: signSession(employee),
    user: mapEmployee(employee)
  };
}

export function readSessionFromRequest(req) {
  const token = parseCookies(req.headers.cookie || "")[COOKIE_NAME];
  return token ? verifySession(token) : null;
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function mapSession(session) {
  return {
    id: session.sub,
    email: session.email,
    name: session.name,
    role: session.role
  };
}

function mapEmployee(employee) {
  return {
    id: employee.id,
    email: employee.email,
    name: employee.name,
    role: employee.role
  };
}

function signSession(employee) {
  const payload = {
    sub: employee.id,
    email: employee.email,
    name: employee.name,
    role: employee.role,
    exp: Date.now() + SESSION_TTL_MS
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

function verifySession(token) {
  const [encoded, sig] = String(token || "").split(".");
  if (!encoded || !sig || !safeEqual(sig, signature(encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

function verifyPassword(password, storedHash) {
  const [scheme, iterationsText, salt, expected] = String(storedHash || "").split("$");
  if (scheme !== "pbkdf2_sha256" || !salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(String(password || ""), salt, Number(iterationsText), 32, "sha256").toString("hex");
  return safeEqual(actual, expected);
}

function signature(value) {
  return crypto.createHmac("sha256", env.sessionSecret).update(value).digest("base64url");
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function parseCookies(header) {
  return Object.fromEntries(
    header.split(";").map(part => {
      const [key, ...value] = part.trim().split("=");
      return [key, decodeURIComponent(value.join("=") || "")];
    }).filter(([key]) => key)
  );
}
