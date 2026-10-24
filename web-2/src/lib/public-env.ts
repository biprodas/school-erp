// `NEXT_PUBLIC_*` values are inlined at build time, so each one has to be
// read with its full literal name; they are safe to use in client code.
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "lvh.me"

export const publicEnv = {
  /** Apex domain; school hosts are `<slug>.<rootDomain>`. */
  rootDomain,
  /** Host of the platform admin app. */
  adminHost: process.env.NEXT_PUBLIC_ADMIN_HOST || `admin.${rootDomain}`,
  /** Port added to absolute links in development (empty in production). */
  appPort: process.env.NEXT_PUBLIC_APP_PORT || "",
} as const
