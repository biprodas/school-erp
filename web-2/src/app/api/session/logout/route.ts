import { NextResponse, type NextRequest } from "next/server"

import { backendUrl, callBackend } from "~/lib/api/backend"
import { backendHeaders } from "~/lib/bff/headers"
import { clientInfo } from "~/lib/client-ip"
import { passesCsrfCheck } from "~/lib/bff/rules"
import { realmOf, resolveHost } from "~/lib/resolve-host"
import { SESSION_COOKIES } from "~/lib/session/cookie"
import { ensureFreshSession } from "~/lib/session/fresh"
import { applyCookieUpdate } from "~/lib/session/response-cookie"

const LOGOUT_PATHS = {
  tenant: { one: "/auth/logout", all: "/auth/logout-all" },
  platform: { one: "/platform/auth/logout", all: "/platform/auth/logout-all" },
} as const

/**
 * Signs out: ends the backend session (or, with `{ "everywhere": true }`,
 * every session of the account, in every school and the platform), then
 * deletes this host's cookie. The cookie goes even when the backend call
 * fails, so the browser is signed out either way.
 */
export async function POST(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? ""
  if (!passesCsrfCheck(request.method, request.headers, hostHeader)) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 403,
        message: "Request refused",
        code: "CSRF_REJECTED",
      },
      { status: 403 }
    )
  }

  const host = await resolveHost(hostHeader).catch(() => null)
  const realm = host && realmOf(host)
  if (!host || !realm) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 404,
        message: "Not found",
        code: "NOT_FOUND",
      },
      { status: 404 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    everywhere?: unknown
  } | null
  const { session } = await ensureFreshSession(
    request.cookies.get(SESSION_COOKIES[realm])?.value,
    { realm, slug: host.kind === "school" ? host.slug : null },
    { client: clientInfo(request.headers) }
  )

  if (session) {
    const path = LOGOUT_PATHS[realm][body?.everywhere === true ? "all" : "one"]
    await callBackend(backendUrl(path), {
      method: "POST",
      headers: backendHeaders(request.headers, host, session),
    }).catch(() => undefined)
  }

  const response = NextResponse.json({
    success: true,
    statusCode: 200,
    message: "Signed out",
    data: null,
  })
  return applyCookieUpdate(response, realm, { action: "clear" })
}
