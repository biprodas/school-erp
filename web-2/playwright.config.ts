import { defineConfig, devices } from "@playwright/test"

// The end-to-end suite (doc/frontend-implementation-plan.md 9) runs
// against the docker-compose stack (Postgres, Redis, MinIO, Mailpit), the
// backend on :3900 and this app on :3000. `lvh.me` and its subdomains
// resolve to 127.0.0.1, so school hosts (`acme.lvh.me:3000`) work without
// editing the hosts file. The backend must run with RATE_LIMIT_ENABLED=false:
// every test signs up its own school from the same address.
//
// `E2E_PRODUCTION=true` serves `next start` (after `npm run build`) over
// plain HTTP and turns on the bundle-size and time budgets; otherwise it
// reuses or starts `next dev`.
const baseURL = process.env.E2E_BASE_URL ?? "http://lvh.me:3000"
const isCI = !!process.env.CI
const production = process.env.E2E_PRODUCTION === "true"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 3,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // PRD 8.3: every core flow works at 360 px on a mid-range Android phone.
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: production ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    // The server keeps this environment (API_URL, SESSION_SECRET, …),
    // except PORT: CI sets it for the backend (:3900), and `next dev` /
    // `next start` would take it too. The app listens on baseURL's port.
    env: {
      ...(Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined)
      ) as Record<string, string>),
      PORT: new URL(baseURL).port || "3000",
      ...(production && { ALLOW_INSECURE_HTTP: "true" }),
    },
  },
})
