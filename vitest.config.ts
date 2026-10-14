import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Same precedence as the app's other tools: .env.local wins over .env.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Database tests talk to Neon over HTTP; give them room.
    testTimeout: 30_000,
  },
});
