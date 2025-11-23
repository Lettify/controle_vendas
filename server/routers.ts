import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { env } from "./_core/env.js";
import { TRPCError } from "@trpc/server";
import { RateLimiter, RateLimitError } from "./_core/rateLimiter.js";
import {
  createEmployee,
  getEmployee,
  getEmployeesByCompany,
  getActiveEmployeesByCompany,
  updateEmployee,
  deactivateEmployee,
  deleteEmployee,
  createDailySale,
  getDailySalesByEmployee,
  getDailySalesByCompany,
  getTotalSalesByEmployeeInMonth,
  getTotalSalesByCompanyInMonth,
  deleteDailySale,
  createAccessCode,
  getAccessCodeByCode,
  getAccessCodesByCompany,
  updateAccessCode,
  deleteAccessCode,
  markAccessCodeAsUsed,
  upsertUser,
  getUser,
  createAuthorizedDevice,
  getAuthorizedDeviceByAccessCode,
  touchAuthorizedDevice,
} from "./db.js";
import { getCsrfToken, CSRF_COOKIE } from "./_core/csrf.js";

const loginRateLimiter = new RateLimiter({
  windowMs: 60_000,
  maxAttempts: 5,
  lockoutMs: 15 * 60_000,
});

export const appRouter = router({
  csrf: publicProcedure.query(({ ctx }) => {
    // Gera e retorna o token CSRF, setando o cookie se necessário
    const token = getCsrfToken(ctx.req, ctx.res);
    return { csrfToken: token, cookieName: CSRF_COOKIE };
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      const { maxAge: _maxAge, ...cookieOptions } = getSessionCookieOptions(ctx.req);

      // Rota a sessionVersion do usuário autenticado
      if (ctx.user?.id) {
        const db = await import("./db.js");
        const user = await db.getUser(ctx.user.id);
        if (user) {
          await db.upsertUser({
            id: ctx.user.id,
            sessionVersion: (user.sessionVersion || 1) + 1,
          });
          ctx.logger.info({ userId: ctx.user.id }, '[LOGOUT] sessionVersion rotacionada');
        }
      }

      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: 0,
      });
      return { success: true } as const;
    }),

    // Login com código de acesso
    loginWithCode: publicProcedure
      .input(
        z.object({
          code: z.string().min(1),
          deviceId: z.string().trim().min(8).max(128),
          deviceLabel: z.string().trim().min(1).max(255).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const normalizedCode = input.code.trim();
        const codeForLogs = normalizedCode.toUpperCase();
        const deviceId = input.deviceId.trim().toLowerCase();
        const deviceLabel = input.deviceLabel?.trim() || null;

        ctx.logger.info({ code: codeForLogs, deviceId }, '[LOGIN] Tentando login com código');

        const limiterKey = `${ctx.req.ip ?? "unknown"}:${deviceId}`;

        const throwFailure = (
          message: string,
          code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" = "UNAUTHORIZED"
        ): never => {
          try {
            loginRateLimiter.recordFailure(limiterKey);
          } catch (error) {
            if (error instanceof RateLimitError) {
              throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: error.message,
              });
            }
            throw error;
          }
          throw new TRPCError({
            code,
            message,
          });
        };

        try {
          loginRateLimiter.assertNotLocked(limiterKey);
        } catch (error) {
          if (error instanceof RateLimitError) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: error.message,
            });
          }
          throw error;
        }

        const accessCode = await getAccessCodeByCode(normalizedCode);

        if (!accessCode) {
          ctx.logger.warn({ code: codeForLogs }, '[LOGIN] Código não encontrado no banco');
          throwFailure("Código inválido");
        }
        const codeRecord = accessCode!;

        if (!codeRecord.isActive) {
          ctx.logger.warn({ code: codeForLogs, codeId: codeRecord.id }, '[LOGIN] Código desativado');
          throwFailure("Código desativado");
        }

        if (
          !codeRecord.isReusable &&
          codeRecord.expiresAt &&
          new Date(codeRecord.expiresAt) < new Date()
        ) {
          ctx.logger.warn({ code: codeForLogs, codeId: codeRecord.id }, '[LOGIN] Código expirado');
          throwFailure("Código expirado");
        }

        const existingDevice = await getAuthorizedDeviceByAccessCode(codeRecord.id);
        if (codeRecord.usedAt && !existingDevice) {
          ctx.logger.warn({ code: codeForLogs, codeId: codeRecord.id }, '[LOGIN] Código utilizado mas sem dispositivo registrado');
          throwFailure(
            "Este código já está vinculado a outro dispositivo.",
            "FORBIDDEN"
          );
        }

        if (existingDevice && existingDevice.deviceId !== deviceId) {
          ctx.logger.warn({ code: codeForLogs, existingDeviceId: existingDevice.deviceId }, '[LOGIN] Código já vinculado a outro dispositivo');
          throwFailure("Este código já está vinculado a outro dispositivo.", "FORBIDDEN");
        }

        let userId: string;

        if (codeRecord.usedAt && codeRecord.usedBy) {
          if (!codeRecord.isReusable) {
            console.log('[LOGIN] Código já usado e não é reutilizável');
            throwFailure("Código já foi utilizado", "FORBIDDEN");
          }

          ctx.logger.info({ reusedBy: codeRecord.usedBy }, '[LOGIN] Reutilizando usuário');
          userId = codeRecord.usedBy;
          const existingUser = await getUser(userId);

          if (existingUser) {
            await upsertUser({
              id: userId,
              lastSignedIn: new Date(),
            });
          } else {
            ctx.logger.error({ userId }, '[LOGIN] Usuário não encontrado');
            throwFailure("Usuário não encontrado", "NOT_FOUND");
          }
        } else {
          ctx.logger.info({ code: codeForLogs }, '[LOGIN] Criando novo usuário');
          userId = uuidv4();
          await upsertUser({
            id: userId,
            name: codeRecord.userName || `Usuário ${codeForLogs}`,
            email: codeRecord.userEmail || null,
            role: "user",
            lastSignedIn: new Date(),
          });
        }

        await markAccessCodeAsUsed(codeRecord.id, userId);

        const deviceName = deviceLabel && deviceLabel.length > 0 ? deviceLabel : null;
        if (!existingDevice) {
          await createAuthorizedDevice({
            id: uuidv4(),
            accessCodeId: codeRecord.id,
            userId,
            deviceId,
            ...(deviceName ? { deviceName } : {}),
          });
          ctx.logger.info({ code: codeForLogs, deviceId }, '[LOGIN] Dispositivo registrado para o código');
        } else {
          await touchAuthorizedDevice(existingDevice.id, deviceName);
          ctx.logger.info({ existingDeviceId: existingDevice.deviceId }, '[LOGIN] Dispositivo autorizado reconhecido');
        }

        loginRateLimiter.reset(limiterKey);

        if (!env.JWT_SECRET) {
          // Safety: should never happen in production because env enforces presence
          ctx.logger.error('[LOGIN] JWT_SECRET ausente nas configurações');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Server misconfiguration' });
        }

        const user = await getUser(userId);
        if (!user) {
          ctx.logger.error({ userId }, '[LOGIN] Usuário não encontrado após criação');
          throwFailure("Usuário não encontrado", "NOT_FOUND");
        }

        // Inclui sessionVersion no JWT
        const token = jwt.sign(
          { userId, sessionVersion: user!.sessionVersion },
          env.JWT_SECRET,
          { expiresIn: "7d" }
        );
        ctx.logger.info({ userId }, '[LOGIN] Token JWT criado');

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        ctx.logger.info({ cookieName: COOKIE_NAME }, '[LOGIN] Cookie de sessão definido');

        // Garante que o cookie CSRF seja setado junto com o login
        getCsrfToken(ctx.req, ctx.res);

        ctx.logger.info({ userId: user!.id }, '[LOGIN] Login bem-sucedido para usuário');
        return {
          success: true,
          user: {
            id: user!.id,
            name: user!.name,
            email: user!.email,
            role: user!.role,
            sessionVersion: user!.sessionVersion,
          },
        };
      }),
  }),

  // Gerenciamento de códigos de acesso (admin)
  accessCodes: router({
    create: adminProcedure
      .input(
        z.object({
          companyId: z.string(),
          code: z.string().min(3).max(20).optional(),
          expiresAt: z.date().optional(),
          description: z.string().optional(),
          userName: z.string().optional(),
          userEmail: z.string().email().optional(),
          userPhone: z.string().optional(),
          isReusable: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Usar código customizado ou gerar aleatório
        const code = input.code || Math.random().toString(36).substring(2, 10).toUpperCase();
        const id = uuidv4();

        // Verificar se código customizado já existe
        if (input.code) {
          const existingCode = await getAccessCodeByCode(input.code);
          if (existingCode) {
            throw new Error("Código já existe. Por favor, escolha outro.");
          }
        }

        await createAccessCode({
          id,
          code,
          companyId: input.companyId,
          createdBy: ctx.user.id,
          expiresAt: input.expiresAt,
          description: input.description,
          userName: input.userName,
          userEmail: input.userEmail,
          userPhone: input.userPhone,
          isReusable: input.isReusable ?? false,
          isActive: true,
        });

        return { id, code };
      }),

    list: adminProcedure
      .input(z.object({ companyId: z.string() }))
      .query(async ({ input }) => {
        return await getAccessCodesByCompany(input.companyId);
      }),

    deactivate: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await updateAccessCode(input.id, { isActive: false });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await deleteAccessCode(input.id);
        return { success: true };
      }),
  }),

  // Gerenciamento de funcionários
  employees: router({
    create: protectedProcedure
      .input(
        z.object({
          companyId: z.string(),
          name: z.string().min(1),
          email: z.string().email().or(z.literal("")).optional(),
          phone: z.string().optional(),
          position: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        ctx.logger.info({ employeeName: input.name }, "Tentando criar um novo funcionário.");

        const id = uuidv4();
        await createEmployee({
          id,
          companyId: input.companyId,
          name: input.name,
          email: input.email || null,
          phone: input.phone,
          position: input.position,
          isActive: true,
        });

        ctx.logger.info({ employeeId: id }, "Funcionário criado com sucesso.");

        return { id };
      }),

    list: protectedProcedure
      .input(
        z.object({
          companyId: z.string(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
          searchTerm: z.string().optional(),
          statusFilter: z.enum(['active', 'inactive']).optional(),
        })
      )
      .query(async ({ input }) => {
        const limit = input.limit ?? 10;
        const offset = input.offset ?? 0;
        return await getEmployeesByCompany(input.companyId, {
          limit,
          offset,
          searchTerm: input.searchTerm,
          statusFilter: input.statusFilter,
        });
      }),

    listActive: protectedProcedure
      .input(z.object({ companyId: z.string() }))
      .query(async ({ input }) => {
        return await getActiveEmployeesByCompany(input.companyId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return await getEmployee(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          email: z.string().email().or(z.literal("")).optional(),
          phone: z.string().optional(),
          position: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateEmployee(id, updates);
        return { success: true };
      }),

    deactivate: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await deactivateEmployee(input.id);
        return { success: true };
      }),

    activate: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await updateEmployee(input.id, { isActive: true });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await deleteEmployee(input.id);
        return { success: true };
      }),
  }),

  // Gerenciamento de vendas diárias
  sales: router({
    create: protectedProcedure
      .input(
        z.object({
          employeeId: z.string(),
          companyId: z.string(),
          date: z.string(),
          amount: z.number().positive(),
        })
      )
      .mutation(async ({ input }) => {
        const id = uuidv4();
        await createDailySale({
          id,
          employeeId: input.employeeId,
          companyId: input.companyId,
          date: input.date,
          amount: input.amount.toString(),
        });
        return { id };
      }),

    getByEmployee: protectedProcedure
      .input(
        z.object({
          employeeId: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getDailySalesByEmployee(
          input.employeeId,
          input.startDate,
          input.endDate
        );
      }),

    getByCompany: protectedProcedure
      .input(
        z.object({
          companyId: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getDailySalesByCompany(
          input.companyId,
          input.startDate,
          input.endDate
        );
      }),

    getTotalByEmployeeInMonth: protectedProcedure
      .input(
        z.object({
          employeeId: z.string(),
          year: z.number(),
          month: z.number(),
        })
      )
      .query(async ({ input }) => {
        return await getTotalSalesByEmployeeInMonth(
          input.employeeId,
          input.year,
          input.month
        );
      }),

    getTotalByCompanyInMonth: protectedProcedure
      .input(
        z.object({
          companyId: z.string(),
          year: z.number(),
          month: z.number(),
        })
      )
      .query(async ({ input }) => {
        return await getTotalSalesByCompanyInMonth(
          input.companyId,
          input.year,
          input.month
        );
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await deleteDailySale(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
