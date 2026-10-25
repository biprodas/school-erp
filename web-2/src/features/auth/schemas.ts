import { z } from "zod"

import type { FieldMessage } from "~/lib/forms/form-state"

/**
 * Form schemas for the sign-in pages, shared by the forms (react-hook-form)
 * and the server actions. Messages are keys under `validation` in the
 * message catalogs; the forms translate them.
 *
 * The rules match the backend DTOs (`backend/src/modules/auth/dto/`): a
 * new password has at least 6 characters (`ActivateDto`,
 * `ResetPasswordDto`, `ChangePasswordDto`), and the identifier is an email
 * or a phone number of at most 254 characters (`LoginDto`).
 */

export const PASSWORD_MIN_LENGTH = 6

const message = (key: FieldMessage) => ({ error: key })

const identifier = z
  .string(message("identifierRequired"))
  .trim()
  .min(1, message("identifierRequired"))
  .max(254, message("identifierTooLong"))

/** A password being typed to sign in: anything non-empty. */
const currentPassword = z
  .string(message("passwordRequired"))
  .min(1, message("passwordRequired"))

/** A password being chosen. */
export const newPassword = z
  .string(message("passwordRequired"))
  .min(1, message("passwordRequired"))
  .min(PASSWORD_MIN_LENGTH, message("passwordTooShort"))

/** New password plus its confirmation, which must match. */
const passwordPair = z
  .object({
    password: newPassword,
    confirmPassword: z.string(message("passwordRequired")),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    ...message("passwordsDontMatch"),
  })

export const loginSchema = z.object({
  identifier,
  password: currentPassword,
})

export const forgotPasswordSchema = z.object({
  email: z
    .string(message("emailRequired"))
    .trim()
    .min(1, message("emailRequired"))
    .pipe(z.email(message("emailInvalid"))),
})

export const resetPasswordSchema = passwordPair

/** A new account chooses its password. */
export const activateNewSchema = passwordPair

/** An account that already has a password confirms it. */
export const activateExistingSchema = z.object({ password: currentPassword })

export const changePasswordSchema = z
  .object({
    currentPassword,
    password: newPassword,
    confirmPassword: z.string(message("passwordRequired")),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    ...message("passwordsDontMatch"),
  })

export type LoginValues = z.infer<typeof loginSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
export type ActivateNewValues = z.infer<typeof activateNewSchema>
export type ActivateExistingValues = z.infer<typeof activateExistingSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
