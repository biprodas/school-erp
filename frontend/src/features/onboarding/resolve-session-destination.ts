import type { Session } from "next-auth";
import type { PlatformTenant } from "~/apis/platform/tenants/types";
import { PLATFORM_LOGIN_REDIRECT } from "~/constants/routes";
import { serverApi } from "~/lib/api/server";
import {
  resolveOwnerDestination,
  resolveOwnerDestinationFromBootstrap,
} from "./resolve-destination";

/**
 * Resolves the owner's destination from the JWT when present; falls back to a
 * one-time API fetch for legacy sessions that predate `onboardingBootstrapStatus`.
 */
export async function resolveOwnerDestinationForSession(
  session: Session,
): Promise<string> {
  if (session.authKind !== "platform" || session.user.isAdmin) {
    return PLATFORM_LOGIN_REDIRECT;
  }

  if (session.onboardingBootstrapStatus !== undefined) {
    return resolveOwnerDestinationFromBootstrap(
      session.onboardingBootstrapStatus,
    );
  }

  try {
    const tenants =
      (await serverApi.get<PlatformTenant[]>("/tenants")) ?? [];
    return resolveOwnerDestination(tenants);
  } catch {
    return resolveOwnerDestinationFromBootstrap(null);
  }
}
