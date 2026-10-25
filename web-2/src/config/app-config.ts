// Hosts and ports of this deployment, safe for browser code. `NEXT_PUBLIC_*`
// values are inlined at build time, so each is read with its full literal
// name. No `~` imports: `next.config.ts` reads this file too.

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "lvh.me"
const appPort = process.env.NEXT_PUBLIC_APP_PORT || ""

export const appConfig = {
  /** Apex domain; school hosts are `<slug>.<rootDomain>`. */
  rootDomain,
  /** Host of the platform admin app. */
  adminHost: process.env.NEXT_PUBLIC_ADMIN_HOST || `admin.${rootDomain}`,
  /** Port added to absolute links in development (empty in production). */
  appPort,
  /** The app's own address on the apex, e.g. `http://lvh.me:3000`. */
  appUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    `http://${rootDomain}${appPort ? `:${appPort}` : ""}`,
  isProduction: process.env.NODE_ENV === "production",
} as const
