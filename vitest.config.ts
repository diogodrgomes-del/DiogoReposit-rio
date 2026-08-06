import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@mark/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@mark/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
      "@mark/auth": fileURLToPath(new URL("./packages/auth/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "testes/**/*.test.ts"],
    // argon2id gasta ~19 MiB e algumas centenas de ms por hash, de proposito.
    testTimeout: 30_000,
  },
});
