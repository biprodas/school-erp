import { z } from "zod/mini"

import type { FieldMessage } from "~/lib/forms/form-state"
import { isReservedSlug, isValidSlug } from "~/lib/tenancy/slugs"

// Rules from `StartSignupDto` (backend/src/modules/signup/dto/signup.dto.ts)
// and `FindSchoolDto`. Messages are keys under `validation`.

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

/**
 * A name between `min` and `max` characters, with its own message for
 * each way it can be wrong (the first one found is shown).
 */
const name = (
  min: number,
  max: number,
  messages: {
    required: FieldMessage
    tooShort: FieldMessage
    tooLong: FieldMessage
  }
) =>
  z
    .string(message(messages.required))
    .check(
      z.trim(),
      z.minLength(1, message(messages.required)),
      z.minLength(min, message(messages.tooShort)),
      z.maxLength(max, message(messages.tooLong))
    )

export const signupSchema = z
  .object({
    schoolName: name(3, 100, {
      required: "schoolNameRequired",
      tooShort: "schoolNameTooShort",
      tooLong: "schoolNameTooLong",
    }),
    slug,
    ownerName: name(2, 100, {
      required: "ownerNameRequired",
      tooShort: "ownerNameTooShort",
      tooLong: "ownerNameTooLong",
    }),
    email,
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
