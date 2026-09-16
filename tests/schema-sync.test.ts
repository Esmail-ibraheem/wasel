import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toPostgresSchema } from "../scripts/make-postgres-schema";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("prisma/schema.postgres.prisma", () => {
  it("is exactly what make-postgres-schema produces from schema.prisma (run `pnpm schema:postgres` if this fails)", () => {
    const sqlite = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
    const postgres = fs.readFileSync(path.join(root, "prisma", "schema.postgres.prisma"), "utf8");
    expect(postgres.replace(/\r\n/g, "\n")).toBe(toPostgresSchema(sqlite).replace(/\r\n/g, "\n"));
    expect(postgres).toContain('provider  = "postgresql"');
  });
});
