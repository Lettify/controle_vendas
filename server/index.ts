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
import rateLimit from 'express-rate-limit';
import helmet from "helmet";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limita cada IP a 100 requisições por janela
  standardHeaders: true, // Retorna informações do limite nos cabeçalhos `RateLimit-*`
  legacyHeaders: false, // Desabilita os cabeçalhos `X-RateLimit-*`
  skip: (req) => req.path.startsWith("/trpc/sales.create"),
  handler: (req, res, _next, options) => {
    const retryAfter = Math.ceil((options.windowMs ?? 60_000) / 1000);
    res.status(options.statusCode ?? 429).json({
      error: {
        code: -32004,
        message: "Excesso de requisições. Tente novamente em instantes.",
        data: {
          code: "TOO_MANY_REQUESTS",
          httpStatus: options.statusCode ?? 429,
          path: req.originalUrl,
          retryAfter,
        },
      },
    });
  },
});

const app = express();

// Aplica o rate limiter a todas as requisições
app.use(limiter);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Desabilitado para evitar conflitos com o frontend em dev (Vite)
  })
);

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

// Configuração CORS
const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Debug middleware (apenas em desenvolvimento)
if (env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    logger.debug({
      method: req.method,
      path: req.path,
      cookies: req.cookies,
      headers: {
        origin: req.headers.origin,
        referer: req.headers.referer,
        'user-agent': req.headers['user-agent']
      }
    }, '[Request Debug]');
    next();
  });
}

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
