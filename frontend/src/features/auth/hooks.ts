"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { signIn, useSession } from "next-auth/react";
import { getClientTenantSlug } from "~/lib/tenant";
import { authKeys } from "~/lib/api/query-keys";
import type { RegisterPayload } from "~/types/api";
import type { AuthKind } from "~/types/user";
import { fetchMe, registerUser } from "./api";

export interface CredentialsInput {
  email: string;
  password: string;
}

/**
 * Sign in via the credentials provider for the given auth surface. For tenant
 * auth, the slug comes from the explicit `tenantSlug` arg (workspace field) or
 * falls back to the current subdomain.
 */
export function signInWithCredentials(
  authKind: AuthKind,
  { email, password }: CredentialsInput,
  tenantSlug?: string,
) {
  if (authKind === "platform") {
    return signIn("platform-credentials", {
      email,
      password,
      redirect: false,
    });
  }
  return signIn("tenant-credentials", {
    email,
    password,
    tenantSlug: tenantSlug || getClientTenantSlug() || "",
    redirect: false,
  });
}

export interface RegisterInput {
  payload: RegisterPayload;
  tenantSlug?: string;
}

/**
 * Register, then immediately sign the new user in. Returns the NextAuth
 * sign-in result so the caller can redirect / toast.
 */
export function useRegister(authKind: AuthKind) {
  return useMutation({
    mutationFn: async ({ payload, tenantSlug }: RegisterInput) => {
      const slug =
        authKind === "tenant"
          ? tenantSlug || getClientTenantSlug() || undefined
          : undefined;
      await registerUser(authKind, payload, slug);
      return signInWithCredentials(
        authKind,
        { email: payload.email, password: payload.password },
        slug,
      );
    },
  });
}

/** Current user from the backend `/me` endpoint (enabled once authenticated). */
export function useCurrentUser<T = unknown>() {
  const { data: session, status } = useSession();
  const authKind = session?.authKind ?? "tenant";
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => fetchMe<T>(authKind),
    enabled: status === "authenticated",
  });
}
