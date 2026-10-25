// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearTenantCache, lookupTenant, TenantLookupError } from "./tenant"

const apiUrl = "http://api.test"
const school = {
  kind: "school",
  hostname: "acme.lvh.me",
  slug: "acme",
} as const
const custom = { kind: "custom", hostname: "erp.acme-school.com" } as const

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
const ok = (data: unknown) => json({ success: true, statusCode: 200, data })

let fetchMock: ReturnType<typeof vi.fn>
const lookup = (host: typeof school | typeof custom) =>
  lookupTenant(host, { apiUrl, fetch: fetchMock as unknown as typeof fetch })
const calledUrl = (n = 0) => String(fetchMock.mock.calls[n][0])

beforeEach(() => {
  clearTenantCache()
  fetchMock = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("lookupTenant", () => {
  it("resolves a subdomain through by-slug", async () => {
    fetchMock.mockResolvedValue(ok({ slug: "acme", name: "Acme School" }))

    await expect(lookup(school)).resolves.toEqual({
      status: "found",
      slug: "acme",
      name: "Acme School",
    })
    expect(calledUrl()).toBe(
      "http://api.test/api/public/organizations/by-slug?slug=acme"
    )
  })

  it("resolves a custom domain through resolve", async () => {
    fetchMock.mockResolvedValue(ok({ slug: "acme", name: "Acme School" }))

    await expect(lookup(custom)).resolves.toMatchObject({ slug: "acme" })
    expect(calledUrl()).toBe(
      "http://api.test/api/public/organizations/resolve?host=erp.acme-school.com"
    )
  })

  it("reports an old slug as moved", async () => {
    fetchMock.mockResolvedValue(
      ok({ slug: "acme-high", name: "Acme", movedFrom: "acme" })
    )
    await expect(lookup(school)).resolves.toEqual({
      status: "moved",
      slug: "acme-high",
    })
  })

  it("caches answers, not-found included, for a minute", async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(json({ success: false, statusCode: 404 }, 404))

    await expect(lookup(school)).resolves.toEqual({ status: "not-found" })
    await expect(lookup(school)).resolves.toEqual({ status: "not-found" })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(61_000)
    fetchMock.mockResolvedValue(ok({ slug: "acme", name: "Acme" }))
    await expect(lookup(school)).resolves.toMatchObject({ status: "found" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("shares one request between concurrent lookups of a host", async () => {
    fetchMock.mockResolvedValue(ok({ slug: "acme", name: "Acme" }))

    await Promise.all([lookup(school), lookup(school), lookup(school)])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("throws, without caching, when the backend can't answer", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(lookup(school)).rejects.toBeInstanceOf(TenantLookupError)

    fetchMock.mockResolvedValueOnce(json({ success: false }, 500))
    await expect(lookup(school)).rejects.toBeInstanceOf(TenantLookupError)

    fetchMock.mockResolvedValueOnce(ok({ slug: "acme", name: "Acme" }))
    await expect(lookup(school)).resolves.toMatchObject({ status: "found" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
