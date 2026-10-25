import { z } from "zod/mini"

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

const email = z.pipe(
  z
    .string(message("emailRequired"))
    .check(
      z.trim(),
      z.minLength(1, message("emailRequired")),
      z.maxLength(254, message("emailInvalid"))
    ),
  z.email(message("emailInvalid"))
)

/** A school address (slug), checked the way the backend does. */
export const slug = z.string(message("slugRequired")).check(
  z.trim(),
  z.toLowerCase(),
  z.minLength(1, message("slugRequired")),
  z.refine(isValidSlug, message("slugInvalid")),
  z.refine((value) => !isReservedSlug(value), message("slugReserved"))
)

const length = (min: number, max: number, key: FieldMessage) =>
  z
    .string(message(key))
    .check(
      z.trim(),
      z.minLength(min, message(key)),
      z.maxLength(max, message(key))
    )

export const signupSchema = z
  .object({
    schoolName: length(3, 100, "schoolNameLength"),
    type: z.enum(SCHOOL_TYPES, message("typeRequired")),
    slug,
    ownerName: length(2, 100, "ownerNameLength"),
    email,
    phone: z.string().check(
      z.trim(),
      z.refine(
        (v) => v === "" || normalizePhone(v) !== null,
        message("phoneInvalid")
      )
    ),
    password: z.string(),
    /** From "Sign up with Google": the email is verified, no password. */
    googleTicket: z.string(),
  })
  .check(
    z.superRefine((value, ctx) => {
      if (value.googleTicket) return
      if (value.password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: value.password
            ? "signupPasswordTooShort"
            : "passwordRequired",
        })
      } else if (value.password.length > 128) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "passwordTooLong",
        })
      }
    })
  )

export const findSchoolSchema = z.object({ email })

/**
 * "Enter your school's address": the slug, or a pasted address such as
 * `https://acme.kampasy.com/login`, which is cut down to its slug.
 */
export const schoolAddressSchema = (rootDomain: string) =>
  z.object({
    address: z.pipe(
      z.pipe(
        z.string(message("slugRequired")),
        z.transform((value: string) => addressToSlug(value, rootDomain))
      ),
      slug
    ),
  })

export function addressToSlug(value: string, rootDomain: string): string {
  let text = value.trim().toLowerCase()
  text = text.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0]
  text = text.replace(/:\d+$/, "")
  const suffix = `.${rootDomain.toLowerCase()}`
  return text.endsWith(suffix) ? text.slice(0, -suffix.length) : text
}

export type SignupValues = z.input<typeof signupSchema>
