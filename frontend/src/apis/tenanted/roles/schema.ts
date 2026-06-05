import { z } from "zod";

/** Validation for the role form (matches the backend Create/Update role DTOs). */
export const roleSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(64, "Name must be at most 64 characters"),
  description: z
    .string()
    .max(255, "Description must be at most 255 characters")
    .optional(),
  permissions: z.array(z.string()),
});

export type RoleValues = z.infer<typeof roleSchema>;
