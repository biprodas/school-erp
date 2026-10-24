import { describe, expect, it } from "vitest"

import { classifyHost, normalizeHostname, urlOnHost } from "./hosts"

const config = { rootDomain: "lvh.me", adminHost: "admin.lvh.me" }
const classify = (host: string) => classifyHost(host, config)

describe("normalizeHostname", () => {
  it.each([
    ["Acme.LVH.me:3000", "acme.lvh.me"],
    ["acme.lvh.me.", "acme.lvh.me"],
    [" lvh.me ", "lvh.me"],
    ["[::1]:3000", "[::1]"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected)
  })
})

describe("classifyHost", () => {
  it.each([
    "lvh.me",
    "www.lvh.me",
    "LVH.ME:3000",
    "localhost:3000",
    "127.0.0.1",
    "[::1]:3000",
  ])("serves the marketing site on %s", (host) => {
    expect(classify(host).kind).toBe("site")
  })

  it("serves the platform admin app on the admin host", () => {
    expect(classify("admin.lvh.me:3000")).toEqual({
      kind: "admin",
      hostname: "admin.lvh.me",
    })
  })

  it("reads the school slug from its subdomain", () => {
    expect(classify("Dhaka-Ideal.lvh.me:3000")).toEqual({
      kind: "school",
      hostname: "dhaka-ideal.lvh.me",
      slug: "dhaka-ideal",
    })
  })

  it.each([
    ["a reserved slug", "api.lvh.me"],
    ["a reserved slug", "dashboard.lvh.me"],
    ["a too-short slug", "ab.lvh.me"],
    ["a slug ending in a hyphen", "acme-.lvh.me"],
    ["a deeper subdomain", "x.acme.lvh.me"],
    ["a bare word", "intranet"],
    ["an empty host", ""],
  ])("never serves %s (%s)", (_label, host) => {
    expect(classify(host).kind).toBe("unknown")
  })

  it("treats any other domain as a possible custom domain", () => {
    expect(classify("ERP.Acme-School.com")).toEqual({
      kind: "custom",
      hostname: "erp.acme-school.com",
    })
    // A look-alike of the root domain is just another domain.
    expect(classify("acme.lvh.me.evil.com").kind).toBe("custom")
    expect(classify("evil-lvh.me").kind).toBe("custom")
  })

  it("follows the configured root and admin hosts", () => {
    const prod = { rootDomain: "kampasy.com", adminHost: "admin.kampasy.com" }
    expect(classifyHost("acme.kampasy.com", prod)).toMatchObject({
      kind: "school",
      slug: "acme",
    })
    expect(classifyHost("acme.lvh.me", prod).kind).toBe("custom")
  })
})

describe("urlOnHost", () => {
  it("keeps the protocol and port of the current origin", () => {
    expect(urlOnHost("http://acme.lvh.me:3000", "lvh.me", "/find-school")).toBe(
      "http://lvh.me:3000/find-school"
    )
    expect(urlOnHost("https://acme.kampasy.com", "kampasy.com")).toBe(
      "https://kampasy.com/"
    )
  })
})
