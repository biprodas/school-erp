import { z } from "zod";
import { USER_STATUSES } from "./types";

/** Canonical validation for the create-user form (matches the backend DTO). */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  status: z.enum(USER_STATUSES),
  roleIds: z.array(z.string().uuid()),
});

/** Edit form: name + status are PATCHed; roleIds are reconciled separately
 * via the role assign/unassign endpoints. */
export const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.enum(USER_STATUSES),
  roleIds: z.array(z.string().uuid()),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type EditUserValues = z.infer<typeof editUserSchema>;
