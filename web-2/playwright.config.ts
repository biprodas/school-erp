import { defineConfig, devices } from "@playwright/test"

// `lvh.me` and its subdomains resolve to 127.0.0.1, so school hosts
// (`acme.lvh.me:3000`) work locally without editing the hosts file.
const baseURL = process.env.E2E_BASE_URL ?? "http://lvh.me:3000"
const isCI = !!process.env.CI

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
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
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
