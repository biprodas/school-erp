import type { Page } from "@playwright/test"

import { adminUrl, E2E, onHost } from "./support/env"
import { createSchool, openSchool, ownerPage, settle } from "./support/school"
import { expect, test } from "./support/test"

// M9: security headers and CSP, and no token anywhere the page can read.

/** A JWT (header.payload.signature), the shape of every access token. */
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/
/** The token fields of the backend's sign-in answers. */
const TOKEN_FIELDS = /\b(access_token|refresh_token)\b/

function nonceOf(csp: string | undefined): string {
  const nonce = /'nonce-([^']+)'/.exec(csp ?? "")?.[1]
  expect(nonce, "CSP nonce").toBeTruthy()
  return nonce!
}

async function expectPageHeaders(page: Page, url: string) {
  const response = await page.goto(url)
  const headers = response!.headers()
  const csp = headers["content-security-policy"]
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("'strict-dynamic'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  if (E2E.production) expect(csp).not.toContain("unsafe-eval")
  expect(headers["x-frame-options"]).toBe("DENY")
  expect(headers["x-content-type-options"]).toBe("nosniff")
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
  expect(headers["x-powered-by"]).toBeUndefined()

  // Every script the server sent carries this response's nonce (in
  // development Turbopack adds its HMR client without one).
  const nonce = nonceOf(csp)
  await settle(page)
  if (!E2E.production) return
  const scripts = await page.$$eval("script", (els) =>
    els.map((el) => ({
      nonce: (el as HTMLScriptElement).nonce,
      src: (el as HTMLScriptElement).src,
    }))
  )
  expect(scripts.length).toBeGreaterThan(0)
  for (const script of scripts) expect(script.nonce, script.src).toBe(nonce)
}

test("pages on every host send the CSP and security headers", async ({
  page,
}) => {
  const school = await createSchool("headers")
  for (const url of [
    onHost(null, "/"),
    school.url("/login"),
    adminUrl("/login"),
  ]) {
    await expectPageHeaders(page, url)
  }
  // A fresh nonce per response.
  const first = (await page.goto(school.url("/login")))!.headers()
  const second = (await page.goto(school.url("/login")))!.headers()
  expect(nonceOf(first["content-security-policy"])).not.toBe(
    nonceOf(second["content-security-policy"])
  )
  // The BFF gets the static headers too.
  const api = await page.request.get(school.url("/api/auth/me"))
  expect(api.headers()["x-content-type-options"]).toBe("nosniff")
  expect(api.headers()["x-frame-options"]).toBe("DENY")
})

test("no token reaches the browser: not in HTML, storage, cookies or scripts", async ({
  page,
}) => {
  const school = await createSchool("tokens")
  const bodies: string[] = []
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? ""
    if (/javascript|html|json|x-component/.test(type)) {
      bodies.push(await response.text().catch(() => ""))
    }
  })
  await ownerPage(page, school)
  await openSchool(page, school)
  await page.goto(school.url("/dashboard/account"))
  await settle(page)

  const html = await page.content()
  const storage = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage })
  )
  const visibleCookies = await page.evaluate(() => document.cookie)
  for (const [where, text] of [
    ["HTML", html],
    ["storage", storage],
    ["document.cookie", visibleCookies],
    ...bodies.map((body, i) => [`response ${i}`, body] as const),
  ] as const) {
    expect(JWT.test(text), `JWT in ${where}`).toBe(false)
    expect(TOKEN_FIELDS.test(text), `token fields in ${where}`).toBe(false)
  }

  // The session cookie itself is httpOnly and same-site.
  const session = (await page.context().cookies(school.origin)).find((c) =>
    c.name.endsWith("_session")
  )
  expect(session?.httpOnly).toBe(true)
  expect(session?.sameSite).toBe("Lax")
})
