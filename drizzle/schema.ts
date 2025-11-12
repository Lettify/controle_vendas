import { pgTable, varchar, text, timestamp, decimal, boolean, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Enums
 */
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

/**
 * Tabela de usuários - autenticação por código único
 */
export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in", { mode: 'date', withTimezone: true }).defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de códigos de acesso para autenticação
 */
export const accessCodes = pgTable("access_codes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  companyId: varchar("company_id", { length: 64 }).notNull(),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { mode: 'date', withTimezone: true }),
  usedAt: timestamp("used_at", { mode: 'date', withTimezone: true }),
  usedBy: varchar("used_by", { length: 64 }),
  isActive: boolean("is_active").default(true).notNull(),
  isReusable: boolean("is_reusable").default(false).notNull(),
  description: text("description"),
  userName: varchar("user_name", { length: 255 }),
  userEmail: varchar("user_email", { length: 320 }),
  userPhone: varchar("user_phone", { length: 20 }),
});

export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = typeof accessCodes.$inferInsert;

/**
 * Dispositivos autorizados para cada código de acesso
 */
export const authorizedDevices = pgTable(
  "authorized_devices",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    accessCodeId: varchar("access_code_id", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    deviceName: varchar("device_name", { length: 255 }),
    registeredAt: timestamp("registered_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accessCodeIdx: uniqueIndex("authorized_devices_access_code_id_idx").on(table.accessCodeId),
    deviceIdx: uniqueIndex("authorized_devices_device_id_idx").on(table.deviceId),
  })
);

export type AuthorizedDevice = typeof authorizedDevices.$inferSelect;
export type InsertAuthorizedDevice = typeof authorizedDevices.$inferInsert;

/**
 * Tabela de funcionários
 */
export const employees = pgTable("employees", {
  id: varchar("id", { length: 64 }).primaryKey(),
  companyId: varchar("company_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 255 }),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 3 }).default("0.005").notNull(), // 0.5% = 0.005
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

/**
 * Tabela de vendas diárias
 */
export const dailySales = pgTable("daily_sales", {
  id: varchar("id", { length: 64 }).primaryKey(),
  employeeId: varchar("employee_id", { length: 64 }).notNull(),
  companyId: varchar("company_id", { length: 64 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export type DailySale = typeof dailySales.$inferSelect;
export type InsertDailySale = typeof dailySales.$inferInsert;
