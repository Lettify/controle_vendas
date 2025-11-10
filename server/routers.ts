import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
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
} from "./db";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Login com código de acesso
    loginWithCode: publicProcedure
      .input(z.object({ code: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        console.log('[LOGIN] Tentando login com código:', input.code);
        const accessCode = await getAccessCodeByCode(input.code);

        if (!accessCode) {
          console.log('[LOGIN] Código não encontrado no banco');
          throw new Error("Código inválido");
        }

        if (!accessCode.isActive) {
          console.log('[LOGIN] Código desativado');
          throw new Error("Código desativado");
        }

        // Verificar expiração apenas se o código não for reutilizável
        if (!accessCode.isReusable && accessCode.expiresAt && new Date(accessCode.expiresAt) < new Date()) {
          console.log('[LOGIN] Código expirado');
          throw new Error("Código expirado");
        }

        let userId: string;

        // Se o código já foi usado e for reutilizável, reutilizar o usuário existente
        if (accessCode.usedAt && accessCode.usedBy) {
          if (!accessCode.isReusable) {
            console.log('[LOGIN] Código já usado e não é reutilizável');
            throw new Error("Código já foi utilizado");
          }

          console.log('[LOGIN] Reutilizando usuário:', accessCode.usedBy);
          userId = accessCode.usedBy;
          const existingUser = await getUser(userId);
          
          if (existingUser) {
            // Atualizar lastSignedIn
            await upsertUser({
              id: userId,
              lastSignedIn: new Date(),
            });
          } else {
            console.log('[LOGIN] Usuário não encontrado');
            throw new Error("Usuário não encontrado");
          }
        } else {
          // Criar novo usuário com os dados do código de acesso
          console.log('[LOGIN] Criando novo usuário');
          userId = uuidv4();
          await upsertUser({
            id: userId,
            name: accessCode.userName || `Usuário ${input.code}`,
            email: accessCode.userEmail || null,
            role: "user",
            lastSignedIn: new Date(),
          });

          // Marcar código como utilizado
          await markAccessCodeAsUsed(accessCode.id, userId);
        }

        // Criar token JWT
        const token = jwt.sign(
          { userId },
          process.env.JWT_SECRET || "secret",
          { expiresIn: "7d" }
        );
        console.log('[LOGIN] Token JWT criado:', token.substring(0, 20) + '...');

        // Salvar cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        console.log('[LOGIN] Opções do cookie:', cookieOptions);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        console.log('[LOGIN] Cookie definido com nome:', COOKIE_NAME);

        const user = await getUser(userId);
        console.log('[LOGIN] Login bem-sucedido para usuário:', user?.name);
        return {
          success: true,
          user: {
            id: user?.id,
            name: user?.name,
            email: user?.email,
            role: user?.role,
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
      .mutation(async ({ input }) => {
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
        return { id };
      }),

    list: protectedProcedure
      .input(z.object({ companyId: z.string() }))
      .query(async ({ input }) => {
        return await getEmployeesByCompany(input.companyId);
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
