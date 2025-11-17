import { Request, Response } from "express";
import { getUser } from "../db.js";
import { COOKIE_NAME } from "../../shared/const.js";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Logger } from "pino";
import baseLogger from "./logger.js";

export type Context = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: "user" | "admin";
  } | null;
  req: Request;
  res: Response;
  logger: Logger;
};

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<Context> {
  let user = null;

  try {
    const token = req.cookies[COOKIE_NAME];
    console.log('[Context] Cookie encontrado:', token ? 'SIM' : 'NÃO');
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: string;
      };
      console.log('[Context] Token decodificado, userId:', decoded.userId);
      const dbUser = await getUser(decoded.userId);
      console.log('[Context] Usuário do banco:', dbUser?.name);
      if (dbUser) {
        user = {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role as "user" | "admin",
        };
      }
    }
  } catch (error) {
    console.log('[Context] Erro ao verificar token:', error);
    // Token inválido ou expirado, continuar sem usuário
  }

  // Pino logger injetado pelo pino-http em ambientes com middleware.
  // Em ambientes serverless (Vercel) `req.log` pode não existir, então usamos um logger padrão.
  const logger: Logger = (req as any).log ?? baseLogger;

  return {
    user,
    req,
    res,
    logger,
  };
}
