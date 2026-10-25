import { apiFetch } from "~/lib/api/client"

/**
 * Signs out (`POST /api/session/logout`; `everywhere` ends every session of
 * the account, in every school) and reloads `/login`. A full page load on
 * purpose: it drops everything cached for the ended session. The cookie
 * is gone even when the backend can't be reached.
 */
export async function signOut({ everywhere = false } = {}) {
  try {
    await apiFetch("/session/logout", {
      method: "POST",
      body: everywhere ? { everywhere: true } : {},
    })
  } catch (error) {
    console.warn("[auth] sign-out answered with an error", error)
  }
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login")
}
