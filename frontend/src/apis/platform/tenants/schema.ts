import { z } from "zod";
import { TENANT_STATUSES } from "./types";

/** Canonical validation for the create-tenant form (matches the backend DTO). */
export const createTenantSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(63)
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  domain: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  domain: z.string().optional(),
  status: z.enum(TENANT_STATUSES),
});

export type CreateTenantValues = z.infer<typeof createTenantSchema>;
export type UpdateTenantValues = z.infer<typeof updateTenantSchema>;
