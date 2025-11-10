import { mysqlTable, varchar, text, timestamp, decimal, boolean, mysqlEnum } from "drizzle-orm/mysql-core";

/**
 * Tabela de usuários - autenticação por código único
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt", { mode: 'date' }).defaultNow(),
  lastSignedIn: timestamp("lastSignedIn", { mode: 'date' }).defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de códigos de acesso para autenticação
 */
export const accessCodes = mysqlTable("access_codes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  companyId: varchar("companyId", { length: 64 }).notNull(),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt", { mode: 'date' }).defaultNow(),
  expiresAt: timestamp("expiresAt", { mode: 'date' }),
  usedAt: timestamp("usedAt", { mode: 'date' }),
  usedBy: varchar("usedBy", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  isReusable: boolean("isReusable").default(false).notNull(),
  description: text("description"),
  userName: varchar("userName", { length: 255 }),
  userEmail: varchar("userEmail", { length: 320 }),
  userPhone: varchar("userPhone", { length: 20 }),
});

export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = typeof accessCodes.$inferInsert;

/**
 * Tabela de funcionários
 */
export const employees = mysqlTable("employees", {
  id: varchar("id", { length: 64 }).primaryKey(),
  companyId: varchar("companyId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: 'date' }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: 'date' }).defaultNow().onUpdateNow(),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

/**
 * Tabela de vendas diárias
 */
export const dailySales = mysqlTable("daily_sales", {
  id: varchar("id", { length: 64 }).primaryKey(),
  employeeId: varchar("employeeId", { length: 64 }).notNull(),
  companyId: varchar("companyId", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt", { mode: 'date' }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: 'date' }).defaultNow().onUpdateNow(),
});

export type DailySale = typeof dailySales.$inferSelect;
export type InsertDailySale = typeof dailySales.$inferInsert;
