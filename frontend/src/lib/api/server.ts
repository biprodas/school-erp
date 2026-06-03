import { headers } from "next/headers";
import { auth } from "~/auth";
import { getTenantSlugFromHost } from "~/lib/tenant";
import { createApiClient, makeHttp } from "./axios";

/**
 * Server API client for Server Components / Route Handlers / Server Actions.
 * Reads the session via `auth()` and falls back to the request host for the
 * tenant slug.
 */
const instance = createApiClient(async () => {
  const session = await auth();
  let tenantSlug = session?.user?.tenant?.slug ?? null;
  if (!tenantSlug) {
    const host = (await headers()).get("host");
    tenantSlug = getTenantSlugFromHost(host);
  }
  return {
    accessToken: session?.accessToken,
    tenantSlug,
  };
});

export const serverApi = makeHttp(instance);
export const serverApiClient = instance;
