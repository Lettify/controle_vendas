import crypto from "crypto";
import type { Request, Response } from "express";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export function getCsrfToken(req: Request, res: Response): string {
  let token = req.cookies[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    // Detecta produção (Vercel) pelo domínio
    const isProd = process.env.NODE_ENV === "production" || req.hostname?.includes("vercel.app");
    // Flags idênticas ao cookie de sessão
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // visível ao JS
      sameSite: "lax",
      secure: isProd ? true : req.protocol === "https",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
      // Removido domain para compatibilidade máxima
    });
  }
  return token;
}

export function validateCsrf(req: Request): boolean {
  const cookie = req.cookies[CSRF_COOKIE];
  const header = req.headers[CSRF_HEADER] || req.headers[CSRF_HEADER.toLowerCase()];

  console.log("[CSRF Debug] Validando token:");
  console.log("[CSRF Debug] Cookie recebido:", cookie);
  console.log("[CSRF Debug] Header recebido:", header);
  console.log("[CSRF Debug] Match:", cookie === header);

  if (!cookie || !header) return false;
  return cookie === header;
}

export { CSRF_COOKIE, CSRF_HEADER };
