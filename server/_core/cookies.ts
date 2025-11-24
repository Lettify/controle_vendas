import { Request } from "express";

export function getSessionCookieOptions(req: Request) {
  const isProd = process.env.NODE_ENV === "production" || req.hostname?.includes("vercel.app");
  return {
    httpOnly: true,
    secure: isProd ? true : req.protocol === "https",
    sameSite: isProd ? "none" as const : "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    domain: isProd ? req.hostname : undefined,
  };
}
