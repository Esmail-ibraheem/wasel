import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Neon's pooled endpoint (PgBouncer, transaction mode) needs `pgbouncer=true`
 * so Prisma skips prepared statements. Adds it when a pooled URL lacks it.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) return undefined;
  if (!/-pooler\./.test(url) || /[?&]pgbouncer=/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "pgbouncer=true";
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
