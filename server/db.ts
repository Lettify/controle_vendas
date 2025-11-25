import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
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
  InsertAuthorizedDevice,
  authorizedDevices,
} from "../drizzle/schema.js";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, {
        max: 1, // Reduzido para serverless
        idle_timeout: 20, // Fecha conexões ociosas após 20s
        connect_timeout: 10, // Timeout de conexão de 10s
        prepare: false, // Desabilita prepared statements (requerido para serverless)
        onnotice: () => { } // Silencia avisos do Supabase
      });
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

export async function getAuthorizedDeviceByAccessCode(accessCodeId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(authorizedDevices)
    .where(eq(authorizedDevices.accessCodeId, accessCodeId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAuthorizedDeviceByDeviceId(deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(authorizedDevices)
    .where(eq(authorizedDevices.deviceId, deviceId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createAuthorizedDevice(
  device: InsertAuthorizedDevice
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(authorizedDevices).values(device);
}

export async function touchAuthorizedDevice(
  id: string,
  deviceName?: string | null
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: Partial<InsertAuthorizedDevice> = {
    lastSeenAt: new Date(),
  };

  if (deviceName !== undefined) {
    updates.deviceName = deviceName ?? null;
  }

  await db
    .update(authorizedDevices)
    .set(updates)
    .where(eq(authorizedDevices.id, id));
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

export async function getEmployeesByCompany(
  companyId: string,
  options: {
    limit: number;
    offset: number;
    searchTerm?: string;
    statusFilter?: 'active' | 'inactive';
  }
) {
  const db = await getDb();
  if (!db) return { employees: [], total: 0 };

  const { limit, offset, searchTerm, statusFilter } = options;

  // Condições base da consulta
  const conditions = [eq(employees.companyId, companyId)];

  // Filtro por status
  if (statusFilter === 'active') {
    conditions.push(eq(employees.isActive, true));
  } else if (statusFilter === 'inactive') {
    conditions.push(eq(employees.isActive, false));
  }

  // Filtro por termo de busca (nome, email ou cargo)
  if (searchTerm) {
    const term = `%${searchTerm.toLowerCase()}%`;
    conditions.push(
      sql`lower(${employees.name}) LIKE ${term} OR lower(${employees.email}) LIKE ${term} OR lower(${employees.position}) LIKE ${term}`
    );
  }

  // Consulta para buscar os funcionários paginados
  const paginatedEmployeesQuery = db
    .select()
    .from(employees)
    .where(and(...conditions))
    .orderBy(employees.name)
    .limit(limit)
    .offset(offset);

  // Consulta para contar o total de funcionários que correspondem aos filtros
  const totalCountQuery = db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(employees)
    .where(and(...conditions));

  // Executa as duas consultas em paralelo
  const [paginatedEmployees, totalCountResult] = await Promise.all([
    paginatedEmployeesQuery,
    totalCountQuery,
  ]);

  // Se não houver funcionários, retorna logo
  if (paginatedEmployees.length === 0) {
    return {
      employees: [],
      total: totalCountResult[0]?.count ?? 0,
    };
  }

  // Buscar estatísticas de vendas para os funcionários retornados
  const employeeIds = paginatedEmployees.map(e => e.id);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Query para total do mês
  const monthSalesQuery = db
    .select({
      employeeId: dailySales.employeeId,
      total: sql<number>`sum(${dailySales.amount})`.mapWith(Number),
    })
    .from(dailySales)
    .where(
      and(
        sql`${dailySales.employeeId} IN ${employeeIds}`,
        gte(dailySales.date, startOfMonth),
        lte(dailySales.date, endOfMonth)
      )
    )
    .groupBy(dailySales.employeeId);

  // Query para última venda
  // Nota: Drizzle/Postgres pode ser chato com "greatest-n-per-group", então vamos fazer uma query simples
  // buscando as últimas vendas desses funcionários e processar no código ou usar distinct on se suportado.
  // Para simplificar e garantir compatibilidade, vamos buscar a última venda de cada um.
  // Uma abordagem eficiente é usar window functions, mas vamos pelo simples:
  // Buscar todas as vendas recentes desses employees e pegar a primeira de cada.

  // Alternativa: Fazer queries individuais em paralelo se forem poucos (limit é 12, então ok).
  // Ou melhor: Buscar as últimas vendas ordenadas por data para esses IDs.
  const lastSalesQuery = db
    .select({
      employeeId: dailySales.employeeId,
      date: dailySales.date,
      amount: dailySales.amount,
    })
    .from(dailySales)
    .where(sql`${dailySales.employeeId} IN ${employeeIds}`)
    .orderBy(desc(dailySales.date));

  const [monthSales, allSales] = await Promise.all([
    monthSalesQuery,
    lastSalesQuery,
  ]);

  const monthSalesMap = new Map(monthSales.map(s => [s.employeeId, s.total]));

  // Processar últimas vendas (pegar a primeira encontrada para cada ID, já que está ordenado DESC)
  const lastSaleMap = new Map();
  for (const sale of allSales) {
    if (!lastSaleMap.has(sale.employeeId)) {
      lastSaleMap.set(sale.employeeId, { date: sale.date, amount: sale.amount });
    }
  }

  // Combinar dados
  const employeesWithStats = paginatedEmployees.map(emp => ({
    ...emp,
    totalMonthSales: monthSalesMap.get(emp.id) ?? 0,
    lastSale: lastSaleMap.get(emp.id) ?? null,
  }));

  return {
    employees: employeesWithStats,
    total: totalCountResult[0]?.count ?? 0,
  };
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
