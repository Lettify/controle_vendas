import { Request } from "express";

export function getSessionCookieOptions(req: Request) {
  const isProd = process.env.NODE_ENV === "production" || req.hostname?.includes("vercel.app");
  return {
    httpOnly: true,
    secure: isProd ? true : req.protocol === "https",
    sameSite: "lax" as const,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
    // Removido 'domain' para compatibilidade máxima
  };
}
