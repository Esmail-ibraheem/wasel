import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default function setup() {
  const dbPath = path.join(root, "prisma", "test.db");
  for (const f of [dbPath, dbPath + "-journal"]) if (fs.existsSync(f)) fs.unlinkSync(f);
  process.env.DATABASE_URL = "file:./test.db";
  execSync("pnpm exec prisma db push --skip-generate", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
