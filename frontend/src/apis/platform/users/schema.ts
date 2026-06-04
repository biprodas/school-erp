import { z } from "zod";
import { PLATFORM_ROLES, USER_STATUSES } from "./types";

/** Canonical validation for the create-user form (matches the backend DTO). */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(PLATFORM_ROLES),
  status: z.enum(USER_STATUSES),
  isAdmin: z.boolean(),
});

export const editUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(PLATFORM_ROLES),
  status: z.enum(USER_STATUSES),
  isAdmin: z.boolean(),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type EditUserValues = z.infer<typeof editUserSchema>;
