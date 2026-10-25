import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "~": fromRoot("./src"),
      // Throws outside React Server Components; tests import server modules
      // directly.
      "server-only": fromRoot("./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Server env (`src/config/env.ts`) for code under test; fetch is always mocked.
    env: {
      API_URL: "http://api.test",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
    },
  },
})
