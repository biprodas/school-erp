import "server-only"

import { z } from "zod"

// Server-only environment variables, validated. Only the config files
// read this (`api-config.ts`, `auth-config.ts`); everything else imports
// the config.

const serverEnvSchema = z.object({
  /** Backend origin without `/api`, e.g. `http://localhost:3900`. */
  API_URL: z.url(),
  /** Key material for sealing the session cookie; 32+ characters. */
  SESSION_SECRET: z.string().min(32),
  /**
   * Reverse proxies in front of this server that append to
   * X-Forwarded-For; the client address is that many entries from the end.
   */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).default(1),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | undefined

/**
 * Validated on first use rather than at import, so `next build` works
 * without these and a missing value fails the first request that needs it
 * with a clear message.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")
    throw new Error(
      `Invalid server environment (see .env.example): ${problems}`
    )
  }
  cached = parsed.data
  return cached
}
