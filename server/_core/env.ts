import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required").optional(),
  DATABASE_URL: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  JWT_SECRET: process.env.JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
});

if (!parsed.success) {
  // Mostra somente chaves inválidas sem vazar valores sensíveis
  const errors = parsed.error.flatten().fieldErrors;
  console.error("Invalid environment variables:", Object.keys(errors));
  throw new Error("Invalid environment variables");
}

// Em produção, exija que JWT_SECRET exista
if (parsed.data.NODE_ENV === "production" && !parsed.data.JWT_SECRET) {
  console.error("JWT_SECRET is required in production environment");
  throw new Error("Missing JWT_SECRET in production");
}

// Fornece um valor para desenvolvimento se ausente (mas sem usar um segredo fraco em production)
export const env = {
  ...parsed.data,
  JWT_SECRET: parsed.data.JWT_SECRET ?? "dev-secret",
};
