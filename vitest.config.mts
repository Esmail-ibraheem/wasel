import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    env: { DATABASE_URL: "file:./test.db" },
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
