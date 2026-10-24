/**
 * The browser's address, for the backend's audit rows, session list and
 * rate limits.
 *
 * Next fills `X-Forwarded-For` with the socket address only when the
 * header is missing (`??=` in its base server), so a value sent by the
 * client itself reaches us unchanged. Each trusted reverse proxy in front
 * of Next appends the address it saw, so the client is the entry
 * `hops` from the end (`TRUSTED_PROXY_HOPS`, default 1: one proxy, such as
 * Caddy, or none in development, where Next's own value is the last).
 * Entries further left are whatever the client claimed and are ignored.
 *
 * Without any reverse proxy, a client that sends the header can still
 * choose its address; production must run behind one.
 */
export function clientIp(
  headers: Headers,
  hops = trustedProxyHops()
): string | null {
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (!entries.length) return null
  return entries[Math.max(0, entries.length - Math.max(1, hops))]
}

function trustedProxyHops(): number {
  const value = Number(process.env.TRUSTED_PROXY_HOPS ?? 1)
  return Number.isInteger(value) && value >= 1 ? value : 1
}

/** Who is calling, as the backend should record it. */
export interface ClientInfo {
  ip: string | null
  userAgent: string | null
}

export const clientInfo = (headers: Headers): ClientInfo => ({
  ip: clientIp(headers),
  userAgent: headers.get("user-agent"),
})

/** Sets `x-forwarded-for` and `user-agent` for a backend call. */
export function setClientHeaders(headers: Headers, client?: ClientInfo) {
  if (client?.ip) headers.set("x-forwarded-for", client.ip)
  if (client?.userAgent) headers.set("user-agent", client.userAgent)
}
