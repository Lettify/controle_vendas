import { Request } from "express";

export function getSessionCookieOptions(req: Request) {
  const isSecure = req.protocol === "https";
  const isLocalhost = req.hostname === "localhost" || req.hostname === "127.0.0.1";
  
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isLocalhost ? ("lax" as const) : ("strict" as const),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
    domain: isLocalhost ? undefined : req.hostname,
  };
}
