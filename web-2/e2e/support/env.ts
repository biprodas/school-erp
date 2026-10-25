// Where the end-to-end suite finds the stack (docker-compose plus the
// backend and this app). `lvh.me` and its subdomains resolve to 127.0.0.1.

const base = new URL(process.env.E2E_BASE_URL ?? "http://lvh.me:3000")

export const E2E = {
  base,
  /** The backend, for setup calls the UI doesn't cover (seeding). */
  api: process.env.E2E_API_URL ?? "http://localhost:3900/api",
  /** Mailpit's HTTP API: activation, verification and reset emails. */
  mailpit: process.env.E2E_MAILPIT_URL ?? "http://localhost:8025/api/v1",
  /** The seeded platform super-admin (`npm run db:seed:core`). */
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@biprodas.dev",
    password: process.env.E2E_ADMIN_PASSWORD ?? "sadmin@123",
  },
  /** Against `next start`: bundle-size and CSP-strictness checks apply. */
  production: process.env.E2E_PRODUCTION === "true",
}

/** `http://<sub>.lvh.me:3000<path>`. */
export function onHost(subdomain: string | null, path = "/"): string {
  const host = subdomain ? `${subdomain}.${base.hostname}` : base.hostname
  return `${base.protocol}//${host}${base.port ? `:${base.port}` : ""}${path}`
}

export const adminUrl = (path = "/") => onHost("admin", path)

/** A short id unique to this run and worker, for slugs and emails. */
export function uniqueId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${Date.now().toString(36)}${random}`
}

/** This calendar date in the school's default time zone. */
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
    new Date()
  )
