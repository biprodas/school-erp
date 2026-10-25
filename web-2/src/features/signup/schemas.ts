import { z } from "zod"

import type { FieldMessage } from "~/lib/forms/form-state"
import { normalizePhone } from "~/lib/phone"
import { isReservedSlug, isValidSlug } from "~/lib/slugs"

// Rules from `StartSignupDto` (backend/src/modules/signup/dto/signup.dto.ts)
// and `FindSchoolDto`. Messages are keys under `validation`.

/** `OrganizationType` in the backend. */
export const SCHOOL_TYPES = [
  "school",
  "college",
  "madrasa",
  "coaching",
  "english_medium",
] as const
export type SchoolType = (typeof SCHOOL_TYPES)[number]

/** Signup asks for a longer password than the in-school forms (`MinLength(8)`). */
export const SIGNUP_PASSWORD_MIN_LENGTH = 8

const message = (key: FieldMessage) => ({ error: key })

const email = z
  .string(message("emailRequired"))
  .trim()
  .min(1, message("emailRequired"))
  .max(254, message("emailInvalid"))
  .pipe(z.email(message("emailInvalid")))

/** A school address (slug), checked the way the backend does. */
export const slug = z
  .string(message("slugRequired"))
  .trim()
  .toLowerCase()
  .min(1, message("slugRequired"))
  .refine(isValidSlug, message("slugInvalid"))
  .refine((value) => !isReservedSlug(value), message("slugReserved"))

export const signupSchema = z
  .object({
    schoolName: z
      .string(message("schoolNameLength"))
      .trim()
      .min(3, message("schoolNameLength"))
      .max(100, message("schoolNameLength")),
    type: z.enum(SCHOOL_TYPES, message("typeRequired")),
    slug,
    ownerName: z
      .string(message("ownerNameLength"))
      .trim()
      .min(2, message("ownerNameLength"))
      .max(100, message("ownerNameLength")),
    email,
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || normalizePhone(v) !== null, {
        ...message("phoneInvalid"),
      }),
    password: z.string(),
    /** From "Sign up with Google": the email is verified, no password. */
    googleTicket: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.googleTicket) return
    if (value.password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: value.password ? "signupPasswordTooShort" : "passwordRequired",
      })
    } else if (value.password.length > 128) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "passwordTooLong",
      })
    }
  })

export const findSchoolSchema = z.object({ email })

/**
 * "Enter your school's address": the slug, or a pasted address such as
 * `https://acme.kampasy.com/login`, which is cut down to its slug.
 */
export const schoolAddressSchema = (rootDomain: string) =>
  z.object({
    address: z
      .string(message("slugRequired"))
      .transform((value) => addressToSlug(value, rootDomain))
      .pipe(slug),
  })

export function addressToSlug(value: string, rootDomain: string): string {
  let text = value.trim().toLowerCase()
  text = text.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0]
  text = text.replace(/:\d+$/, "")
  const suffix = `.${rootDomain.toLowerCase()}`
  return text.endsWith(suffix) ? text.slice(0, -suffix.length) : text
}

export type SignupValues = z.input<typeof signupSchema>
