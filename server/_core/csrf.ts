import crypto from "crypto";
import type { Request, Response } from "express";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export function getCsrfToken(req: Request, res: Response): string {
  let token = req.cookies[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // visível ao JS
      sameSite: "lax",
      secure: req.protocol === "https",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }
  return token;
}

export function validateCsrf(req: Request): boolean {
  const cookie = req.cookies[CSRF_COOKIE];
  const header = req.headers[CSRF_HEADER] || req.headers[CSRF_HEADER.toLowerCase()];
  if (!cookie || !header) return false;
  return cookie === header;
}

export { CSRF_COOKIE, CSRF_HEADER };
