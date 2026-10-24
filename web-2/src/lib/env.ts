import "server-only"

import { z } from "zod"

const serverEnvSchema = z.object({
  /** Backend origin without `/api`, e.g. `http://localhost:3900`. */
  API_URL: z.url(),
  /** Key material for sealing the session cookie; 32+ characters. */
  SESSION_SECRET: z.string().min(32),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | undefined

/**
 * Server-only settings, validated on first use rather than at import, so
 * `next build` works without them and a missing value fails the first
 * request that needs it with a clear message.
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
