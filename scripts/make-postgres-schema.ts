/* eslint-disable no-console */
/**
 * Generates prisma/schema.postgres.prisma from prisma/schema.prisma.
 * The models are identical; only the datasource block differs, so the two
 * files never drift (tests/schema-sync.test.ts enforces it).
 *
 *   pnpm schema:postgres
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "prisma", "schema.prisma");
const out = path.join(root, "prisma", "schema.postgres.prisma");

export const POSTGRES_DATASOURCE = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}`;

export function toPostgresSchema(sqliteSchema: string): string {
  const replaced = sqliteSchema.replace(/datasource db \{[\s\S]*?\n\}/, POSTGRES_DATASOURCE);
  if (replaced === sqliteSchema) throw new Error("datasource block not found in schema.prisma");
  return "// GENERATED from schema.prisma by scripts/make-postgres-schema.ts — do not edit by hand.\n" + replaced;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(out, toPostgresSchema(fs.readFileSync(src, "utf8")));
  console.log(`wrote ${path.relative(root, out)}`);
}
