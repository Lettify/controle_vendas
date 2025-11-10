import { Request, Response } from "express";
import { getUser } from "../db";
import { COOKIE_NAME } from "../../shared/const";
import jwt from "jsonwebtoken";

export interface Context {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: "user" | "admin";
  } | null;
  req: Request;
  res: Response;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  let user = null;

  try {
    const token = req.cookies[COOKIE_NAME];
    console.log('[Context] Cookie encontrado:', token ? 'SIM' : 'NÃO');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
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

  return {
    user,
    req,
    res,
  };
}
