/** Central React Query key factory. */
export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export const tenantKeys = {
  all: ["platform", "tenants"] as const,
  list: () => [...tenantKeys.all, "list"] as const,
  detail: (id: string) => [...tenantKeys.all, "detail", id] as const,
};

export const platformUserKeys = {
  all: ["platform", "users"] as const,
  list: () => [...platformUserKeys.all, "list"] as const,
  detail: (id: string) => [...platformUserKeys.all, "detail", id] as const,
};

export const membershipKeys = {
  all: ["platform", "memberships"] as const,
  list: () => [...membershipKeys.all, "list"] as const,
};
