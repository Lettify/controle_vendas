import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";
import { RateLimitError, RateLimiter } from "./rateLimiter.js";
import { validateCsrf } from "./csrf.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;

const isAuthed = t.middleware(({ ctx, next }) => {
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário não autenticado." });
  }

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  }

  return next();
});

const sharedRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxAttempts: 300,
  lockoutMs: 5 * 60_000,
});

const rateLimiterMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const limiterKey = `${ctx.req.ip ?? "unknown"}:${type}:${path}`;

  try {
    sharedRateLimiter.assertNotLocked(limiterKey);
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
    }
    throw error;
  }

  try {
    const result = await next();
    sharedRateLimiter.reset(limiterKey);
    return result;
  } catch (error) {
    try {
      sharedRateLimiter.recordFailure(limiterKey);
    } catch (rateError) {
      if (rateError instanceof RateLimitError) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: rateError.message });
      }
      throw rateError;
    }
    throw error;
  }
});

const csrfMiddleware = t.middleware(async ({ ctx, type, next }) => {
  if (type === "mutation") {
    if (!validateCsrf(ctx.req)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "CSRF token inválido ou ausente." });
    }
  }
  return next();
});

// Middlewares
const loggerMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  ctx.logger.info({ path, type }, "starting request");
  const result = await next();
  const durationMs = Date.now() - start;
  ctx.logger.info({ path, type, durationMs }, "ending request");
  return result;
});

// Procedimentos
export const publicProcedure = t.procedure.use(loggerMiddleware).use(rateLimiterMiddleware);
export const protectedProcedure = t.procedure.use(isAuthed).use(csrfMiddleware).use(loggerMiddleware).use(rateLimiterMiddleware);
export const adminProcedure = t.procedure.use(isAuthed).use(isAdmin).use(csrfMiddleware).use(loggerMiddleware).use(rateLimiterMiddleware);
export const rateLimitedProcedure = t.procedure.use(rateLimiterMiddleware).use(loggerMiddleware);
