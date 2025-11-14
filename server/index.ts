import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { env } from "./_core/env";
import pinoHttp from "pino-http";
import logger from "./_core/logger";
import { randomUUID } from "crypto";

const app = express();

// Habilita detecção correta de IP atrás de proxies (útil em produção)
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    // Adiciona um ID de requisição a cada log
    genReqId: function (req, res) {
      const existingId = req.id ?? req.headers["x-request-id"];
      if (existingId) return existingId;
      const id = randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
  }),
);

// Configuração CORS para desenvolvimento
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Debug middleware
app.use((req, _res, next) => {
  console.log('[Request]', req.method, req.path);
  console.log('[Cookies recebidos]', req.cookies);
  next();
});

// tRPC middleware
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const PORT = env.PORT ?? 3000;

console.log("[Server] DATABASE_URL:", env.DATABASE_URL ? "✓ Configurado" : "✗ Não encontrado");

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`tRPC endpoint: http://localhost:${PORT}/trpc`);
});
