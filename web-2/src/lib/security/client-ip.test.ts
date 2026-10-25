import { describe, expect, it } from "vitest"

import { clientIp } from "./client-ip"

const xff = (value?: string) =>
  new Headers(value === undefined ? {} : { "x-forwarded-for": value })

describe("clientIp", () => {
  it("takes the address Next or the nearest proxy recorded", () => {
    expect(clientIp(xff("203.0.113.9"), 1)).toBe("203.0.113.9")
    // Behind one proxy that appends the client it saw.
    expect(clientIp(xff("198.51.100.7, 203.0.113.9"), 1)).toBe("203.0.113.9")
  })

  it("ignores addresses the client made up", () => {
    // The client sent "1.2.3.4"; Caddy appended the real address.
    expect(clientIp(xff("1.2.3.4, 203.0.113.9"), 1)).toBe("203.0.113.9")
    // CDN → Caddy → Next: the CDN appended the client, Caddy the CDN.
    expect(clientIp(xff("1.2.3.4, 203.0.113.9, 192.0.2.1"), 2)).toBe(
      "203.0.113.9"
    )
  })

  it("copes with missing, empty or short headers", () => {
    expect(clientIp(xff(), 1)).toBeNull()
    expect(clientIp(xff(" , "), 1)).toBeNull()
    expect(clientIp(xff("203.0.113.9"), 3)).toBe("203.0.113.9")
  })
})
