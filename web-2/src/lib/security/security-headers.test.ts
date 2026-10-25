import { describe, expect, it } from "vitest"

import {
  contentSecurityPolicy,
  createNonce,
  staticSecurityHeaders,
} from "./security-headers"

const production = { httpsOnly: true, development: false }

describe("contentSecurityPolicy", () => {
  it("lets only this response's scripts run in production", () => {
    const csp = contentSecurityPolicy("abc", production)
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'")
    expect(csp).not.toContain("unsafe-eval")
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("upgrade-insecure-requests")
  })

  it("allows what next dev needs, and plain HTTP when not HTTPS-only", () => {
    const csp = contentSecurityPolicy("abc", {
      httpsOnly: false,
      development: true,
    })
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain("connect-src 'self' ws:")
    expect(csp).toContain("img-src 'self' data: blob: https: http:")
    expect(csp).not.toContain("upgrade-insecure-requests")
  })
})

it("createNonce is fresh and unguessable each time", () => {
  const nonces = new Set(Array.from({ length: 50 }, createNonce))
  expect(nonces.size).toBe(50)
  for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16)
})

it("staticSecurityHeaders adds HSTS only over HTTPS", () => {
  const keys = (httpsOnly: boolean) =>
    staticSecurityHeaders({ httpsOnly }).map((h) => h.key)
  expect(keys(true)).toContain("Strict-Transport-Security")
  expect(keys(false)).not.toContain("Strict-Transport-Security")
  expect(keys(false)).toEqual(
    expect.arrayContaining([
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ])
  )
})
