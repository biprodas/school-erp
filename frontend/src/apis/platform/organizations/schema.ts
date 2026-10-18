import { z } from "zod";
import { ORGANIZATION_STATUSES } from "./types";

/** Canonical validation for the create-organization form (matches the backend DTO). */
export const createOrganizationSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(63)
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  ownerUserId: z.string().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  status: z.enum(ORGANIZATION_STATUSES),
});

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationValues = z.infer<typeof updateOrganizationSchema>;
