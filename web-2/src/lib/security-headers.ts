// Security headers (doc/frontend-implementation-plan.md 6). Pure, so
// `next.config.ts`, `src/proxy.ts` and the tests share them.

export interface SecurityOptions {
  /** Served over HTTPS only (`securityConfig.httpsOnly`). */
  httpsOnly: boolean
  /** `next dev`: React needs `eval`, Turbopack's HMR a websocket. */
  development: boolean
}

/** A fresh, unguessable nonce for one response. */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

/**
 * The page CSP. Scripts need this response's nonce (Next.js adds it to its
 * own scripts; `strict-dynamic` lets those load the route's chunks), so an
 * injected `<script>` never runs. Styles allow inline attributes: the UI
 * library positions popovers and the brand color is set with `style=`.
 * Images may come from the file store (signed HTTPS URLs; plain HTTP to
 * the local MinIO in development). The browser only talks to this origin
 * (the BFF); Google sign-in is a navigation, not a request.
 */
export function contentSecurityPolicy(
  nonce: string,
  { httpsOnly, development }: SecurityOptions
): string {
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(development ? ["'unsafe-eval'"] : []),
    ],
    ["style-src", "'self'", "'unsafe-inline'"],
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      "https:",
      ...(development ? ["http:"] : []),
    ],
    ["font-src", "'self'", "data:"],
    ["connect-src", "'self'", ...(development ? ["ws:"] : [])],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ...(httpsOnly ? [["upgrade-insecure-requests"] as [string]] : []),
  ]
  return directives.map((d) => d.join(" ")).join("; ")
}

/** Headers for every response (pages, the BFF, files), set in `next.config.ts`. */
export function staticSecurityHeaders({
  httpsOnly,
}: Pick<SecurityOptions, "httpsOnly">): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(httpsOnly
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]
      : []),
  ]
}
