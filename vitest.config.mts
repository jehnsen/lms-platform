import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover pure logic only (src/lib/domain). No DOM environment needed.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
