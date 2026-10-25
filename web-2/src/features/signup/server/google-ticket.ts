import "server-only"

import { decodeJwt } from "jose"

import type { GoogleSignup } from "../components/signup-form"

/**
 * The email and name in a `google_ticket` (a JWT signed by the backend's
 * `SignupTicketService`), to prefill the form. Only read here, never
 * trusted: the backend verifies the ticket when the form is sent. Null for
 * anything that isn't a signup ticket.
 */
export function readGoogleTicket(ticket: string | null): GoogleSignup | null {
  if (!ticket || ticket.length > 4096) return null
  try {
    const claims = decodeJwt(ticket) as {
      typ?: unknown
      email?: unknown
      name?: unknown
      exp?: unknown
    }
    if (typeof claims.email !== "string") return null
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
      return null
    }
    return {
      ticket,
      email: claims.email,
      name: typeof claims.name === "string" ? claims.name : "",
    }
  } catch {
    return null
  }
}
