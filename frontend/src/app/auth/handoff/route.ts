import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { signIn } from "~/auth";
import { ROUTES } from "~/constants";
import { resolveTenantSlug } from "~/lib/tenant";

/**
 * Cross-host sign-in landing: `/auth/handoff?code=…&next=/onboarding`.
 *
 * Another host (e.g. the platform apex) obtained a single-use, 60-second code
 * for this school from the backend and redirected here. We redeem it
 * server-side for a session on THIS host (host-only cookie), then continue to
 * `next`. Any failure lands on the login page instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sameHostPath(searchParams.get("next"));
  const tenantSlug = await resolveTenantSlug(request.headers.get("host"));

  let signedIn = false;
  if (code && tenantSlug) {
    try {
      await signIn("handoff", { code, tenantSlug, redirect: false });
      signedIn = true;
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
    }
  }

  // `redirect` keeps the session cookie set by `signIn` on the response.
  redirect(signedIn ? next : `${ROUTES.TENANT_LOGIN}?error=handoff`);
}

/** Only a path on this host: `/x`, never `//evil.com` or `/\evil.com`. */
function sameHostPath(next: string | null): string {
  if (!next || !next.startsWith("/") || /^\/[/\\]/.test(next)) {
    return ROUTES.DEFAULT_LOGIN_REDIRECT;
  }
  return next;
}
