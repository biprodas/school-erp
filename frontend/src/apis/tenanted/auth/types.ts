/** Owner/staff account-activation data structures (tenant-scoped). */

export interface ActivationInfo {
  email: string;
  name: string;
  tenant: { id: string; slug: string; schema: string };
}

export interface ActivatePayload {
  token: string;
  password: string;
}

/** `data` from `GET /auth/reset-password?token=` — token pre-check. */
export interface ResetTokenInfo {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

/** `data` from `POST /auth/verify-email`. */
export interface VerifyEmailResult {
  email: string;
  emailVerifiedAt: string;
}

/** Tenant context carried on auth responses, incl. onboarding progress. */
export interface TenantContext {
  id: string;
  slug: string;
  schema: string;
}

/** `data` payload returned by `POST /auth/activate`. */
export interface ActivateResult {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    status: string;
    isAdmin: boolean;
  };
  tenant: TenantContext;
}
