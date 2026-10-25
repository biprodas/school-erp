import type { Page } from "@playwright/test"

import { E2E } from "./support/env"
import {
  bff,
  createSchool,
  firstSignIn,
  ownerPage,
  seedSchool,
  settle,
  uniquePhone,
  type School,
} from "./support/school"
import { expect, test } from "./support/test"

// M9: the sign-in page and the portal on a slow phone connection, and
// how much JavaScript they cost. PRD 8.3: usable on a mid-range Android
// phone at 360 px. Chromium only (network emulation is a CDP feature).

/** Chrome DevTools' "Fast 3G" preset (bytes per second, ms). */
const FAST_3G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
}

/**
 * Compressed JavaScript a first visit may download. The plan's ~150 KB
 * can't hold with this stack: React DOM and the Next.js router and
 * runtime alone are ~115–125 KB before any app code. Measured in M9:
 * /login 264 KB, /student 293 KB. This is a regression guard, not a goal.
 */
const JS_BUDGET_BYTES = 320 * 1024
/** Time until the page answers input on Fast 3G. */
const INTERACTIVE_BUDGET_MS = 6_000

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "network emulation needs Chromium"
)
test.describe.configure({ mode: "serial" })

/**
 * Loads `url` cold on Fast 3G. Returns how long until `ready` resolved
 * and how many JavaScript bytes came over the wire (compressed).
 */
async function coldLoad(page: Page, url: string, ready: () => Promise<void>) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Network.enable")
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
  await cdp.send("Network.emulateNetworkConditions", FAST_3G)

  const scripts: { url: string; bytes: number }[] = []
  const urls = new Map<string, string>()
  cdp.on("Network.responseReceived", (event) => {
    if (event.type === "Script") urls.set(event.requestId, event.response.url)
  })
  cdp.on("Network.loadingFinished", (event) => {
    const url = urls.get(event.requestId)
    if (url) scripts.push({ url, bytes: event.encodedDataLength })
  })

  const started = Date.now()
  await page.goto(url, { waitUntil: "commit" })
  await ready()
  const elapsed = Date.now() - started
  await page.waitForLoadState("networkidle")
  await cdp.send("Network.emulateNetworkConditions", {
    ...FAST_3G,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await cdp.detach()
  // Each file once (a chunk asked for twice with the cache off is one download
  // for a real visitor).
  const unique = [...new Map(scripts.map((s) => [s.url, s])).values()]
  const jsBytes = unique.reduce((sum, s) => sum + s.bytes, 0)
  return { elapsed, jsBytes, scripts: unique }
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

/** The numbers, and the biggest chunks, in the report and the log. */
function report(name: string, result: Awaited<ReturnType<typeof coldLoad>>) {
  const biggest = [...result.scripts]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 6)
    .map((s) => `${kb(s.bytes)} ${s.url.replace(/^.*\/_next\/static\//, "")}`)
  const description = `${name}: interactive after ${result.elapsed} ms on Fast 3G, ${kb(result.jsBytes)} of JS in ${result.scripts.length} files (compressed); biggest: ${biggest.join(", ")}`
  test.info().annotations.push({ type: "performance", description })
  console.log(description)
}

async function checkBudgets(result: { elapsed: number; jsBytes: number }) {
  // Dev builds aren't minified or split for production: only measure there.
  if (!E2E.production) return
  expect(result.jsBytes, "compressed JS").toBeLessThanOrEqual(JS_BUDGET_BYTES)
  expect(result.elapsed, "time to interactive").toBeLessThanOrEqual(
    INTERACTIVE_BUDGET_MS
  )
}

/** The form reacts to input: React has hydrated it. */
async function signInReady(page: Page) {
  const identifier = page.getByLabel("Email or phone")
  await identifier.fill("x")
  await page.getByRole("button", { name: "Sign in" }).click()
  // Client-side validation (only once hydrated) flags the empty password.
  await expect(page.getByText("Password is required")).toBeVisible({
    timeout: 30_000,
  })
}

test("sign-in on Fast 3G", async ({ page }) => {
  const school: School = await createSchool("perf-login")
  const result = await coldLoad(page, school.url("/login"), () =>
    signInReady(page)
  )
  report("/login", result)
  await checkBudgets(result)
})

test("the portal on Fast 3G", async ({ page, browser }) => {
  test.slow()
  const school = await createSchool("perf-portal")
  const owner = await browser.newPage()
  await ownerPage(owner, school)
  const seeded = await seedSchool(owner, [["Class 6", 6, [["Rafi", "Ahmed"]]]])
  const phone = uniquePhone()
  const guardian = await bff<{ id: string }>(owner, "/guardians", {
    method: "POST",
    body: { name: "Karim Ahmed", phone },
  })
  await bff(
    owner,
    `/students/${seeded.students["Rafi Ahmed"]!.studentId}/guardians`,
    {
      method: "POST",
      body: { guardianId: guardian.id, relation: "father", isPrimary: true },
    }
  )
  const slip = await bff<{ temporaryPassword: string }>(
    owner,
    `/guardians/${guardian.id}/portal-slip`,
    { method: "POST", body: {} }
  )
  await owner.close()
  await firstSignIn(page, school.origin, phone, slip.temporaryPassword)
  await settle(page)

  const result = await coldLoad(page, school.url("/student"), async () => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Rafi Ahmed",
      { timeout: 30_000 }
    )
    // The picker's menu opens: the shell is hydrated.
    await page.getByRole("button", { name: /Account menu for/ }).click()
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 30_000 })
  })
  report("/student", result)
  await checkBudgets(result)
})
