import { NextResponse, type NextRequest } from "next/server"

import { appConfig } from "~/config/app-config"
import { urlOnHost } from "~/lib/tenancy/hosts"
import { getRequestHost } from "~/lib/tenancy/request-host"

/**
 * The backend's platform reset email links to the apex
 * (`/reset-password?token=`); only the admin console has platform
 * accounts to reset, so the link continues on the admin host.
 */
export async function GET(request: NextRequest) {
  const { origin } = await getRequestHost()
  const token = request.nextUrl.searchParams.get("token")
  const path = token
    ? `/reset-password?token=${encodeURIComponent(token)}`
    : "/forgot-password"
  return NextResponse.redirect(urlOnHost(origin, appConfig.adminHost, path))
}
