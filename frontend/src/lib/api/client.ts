"use client";

import { getSession, signOut } from "next-auth/react";
import { TENANT_LOGIN } from "~/constants/routes";
import { getClientTenantSlug } from "~/lib/tenant";
import { createApiClient, makeHttp } from "./axios";

/**
 * Browser API client. Pulls the access token + tenant slug from the NextAuth
 * session, falling back to the current subdomain for the tenant header.
 */
const instance = createApiClient(
  async () => {
    const session = await getSession();
    return {
      accessToken: session?.accessToken,
      tenantSlug: session?.user?.tenant?.slug ?? getClientTenantSlug(),
    };
  },
  () => {
    void signOut({ redirectTo: TENANT_LOGIN });
  },
);

export const api = makeHttp(instance);
export const apiClient = instance;
