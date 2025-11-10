import { eq, and, gte, lte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  InsertUser, 
  users, 
  InsertEmployee, 
  employees, 
  InsertDailySale, 
  dailySales,
  InsertAccessCode,
  accessCodes,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, { max: 10 });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============= USER FUNCTIONS =============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values)
      .onConflictDoUpdate({
        target: users.id,
        set: updateSet,
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============= ACCESS CODE FUNCTIONS =============

export async function createAccessCode(code: InsertAccessCode): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(accessCodes).values(code);
}

export async function getAccessCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(accessCodes)
    .where(eq(accessCodes.code, code))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAccessCodesByCompany(companyId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(accessCodes)
    .where(eq(accessCodes.companyId, companyId))
    .orderBy(desc(accessCodes.createdAt));
}

export async function updateAccessCode(
  id: string,
  updates: Partial<InsertAccessCode>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(accessCodes).set(updates).where(eq(accessCodes.id, id));
}

export async function deleteAccessCode(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(accessCodes).where(eq(accessCodes.id, id));
}

export async function markAccessCodeAsUsed(
  id: string,
  userId: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(accessCodes)
    .set({
      usedAt: new Date(),
      usedBy: userId,
    })
    .where(eq(accessCodes.id, id));
}

// ============= EMPLOYEE FUNCTIONS =============

export async function createEmployee(employee: InsertEmployee): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(employees).values(employee);
}

export async function getEmployee(id: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getEmployeesByCompany(companyId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(employees)
    .where(eq(employees.companyId, companyId))
    .orderBy(employees.name);
}

export async function getActiveEmployeesByCompany(companyId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.companyId, companyId),
        eq(employees.isActive, true)
      )
    )
    .orderBy(employees.name);
}

export async function updateEmployee(
  id: string,
  updates: Partial<InsertEmployee>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(employees).set(updates).where(eq(employees.id, id));
}

export async function deactivateEmployee(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(employees)
    .set({ isActive: false })
    .where(eq(employees.id, id));
}

export async function deleteEmployee(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(employees).where(eq(employees.id, id));
}

// ============= DAILY SALES FUNCTIONS =============

export async function createDailySale(sale: InsertDailySale): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(dailySales).values(sale);
}

export async function getDailySalesByEmployee(
  employeeId: string,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(dailySales.employeeId, employeeId)];

  if (startDate && endDate) {
    conditions.push(gte(dailySales.date, startDate));
    conditions.push(lte(dailySales.date, endDate));
  }

  return await db
    .select()
    .from(dailySales)
    .where(and(...conditions))
    .orderBy(desc(dailySales.date));
}

export async function getDailySalesByCompany(
  companyId: string,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(dailySales.companyId, companyId)];

  if (startDate && endDate) {
    conditions.push(gte(dailySales.date, startDate));
    conditions.push(lte(dailySales.date, endDate));
  }

  return await db
    .select()
    .from(dailySales)
    .where(and(...conditions))
    .orderBy(desc(dailySales.date));
}

export async function getTotalSalesByEmployeeInMonth(
  employeeId: string,
  year: number,
  month: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const sales = await db
    .select()
    .from(dailySales)
    .where(
      and(
        eq(dailySales.employeeId, employeeId),
        gte(dailySales.date, startDate),
        lte(dailySales.date, endDate)
      )
    );

  if (sales.length === 0) return 0;
  return sales.reduce((sum, sale) => sum + parseFloat(sale.amount as any), 0);
}

export async function getTotalSalesByCompanyInMonth(
  companyId: string,
  year: number,
  month: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const sales = await db
    .select()
    .from(dailySales)
    .where(
      and(
        eq(dailySales.companyId, companyId),
        gte(dailySales.date, startDate),
        lte(dailySales.date, endDate)
      )
    );

  if (sales.length === 0) return 0;
  return sales.reduce((sum, sale) => sum + parseFloat(sale.amount as any), 0);
}

export async function deleteDailySale(id: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(dailySales).where(eq(dailySales.id, id));
}
