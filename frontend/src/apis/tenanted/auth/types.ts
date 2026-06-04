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
