import { describe, expect, it } from "vitest"

import { normalizePhone } from "~/lib/phone"
import { slugify } from "~/lib/slugs"

import { addressToSlug, schoolAddressSchema, signupSchema } from "./schemas"

const valid = {
  schoolName: "Shapla Model School",
  type: "school",
  slug: "shapla-model-school",
  ownerName: "Rina Akter",
  email: "rina@example.com",
  phone: "",
  password: "long-enough",
  googleTicket: "",
}

const issues = (value: object) => {
  const result = signupSchema.safeParse(value)
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((i) => [String(i.path[0]), i.message])
      )
}

describe("slugify (same as the backend's)", () => {
  it("makes an address from a school's name", () => {
    expect(slugify("Dhaka Ideal School & College")).toBe(
      "dhaka-ideal-school-college"
    )
    expect(slugify("  Café   Lumière  ")).toBe("cafe-lumiere")
    expect(slugify("শাপলা স্কুল")).toBe("")
    expect(slugify("a".repeat(60))).toHaveLength(40)
    expect(slugify(`${"a".repeat(39)} b`)).toBe("a".repeat(39))
  })
})

describe("normalizePhone (same as the backend's)", () => {
  it("accepts Bangladeshi mobiles and E.164", () => {
    expect(normalizePhone("01712-345678")).toBe("+8801712345678")
    expect(normalizePhone("+8801712345678")).toBe("+8801712345678")
    expect(normalizePhone("8801712345678")).toBe("+8801712345678")
    expect(normalizePhone("+447911123456")).toBe("+447911123456")
    expect(normalizePhone("01212345678")).toBeNull()
    expect(normalizePhone("+88012")).toBeNull()
    expect(normalizePhone("hello")).toBeNull()
  })
})

describe("signupSchema", () => {
  it("accepts a complete signup", () => {
    expect(issues(valid)).toEqual({})
  })

  it("follows StartSignupDto's limits", () => {
    expect(
      issues({ ...valid, schoolName: "AB", ownerName: "R", type: "zoo" })
    ).toMatchObject({
      schoolName: "schoolNameLength",
      ownerName: "ownerNameLength",
      type: "typeRequired",
    })
    expect(issues({ ...valid, password: "short" })).toEqual({
      password: "signupPasswordTooShort",
    })
    expect(issues({ ...valid, password: "x".repeat(129) })).toEqual({
      password: "passwordTooLong",
    })
    expect(issues({ ...valid, phone: "12345" })).toEqual({
      phone: "phoneInvalid",
    })
  })

  it("refuses invalid and reserved addresses before asking the backend", () => {
    expect(issues({ ...valid, slug: "a" })).toEqual({ slug: "slugInvalid" })
    expect(issues({ ...valid, slug: "-acme" })).toEqual({ slug: "slugInvalid" })
    expect(issues({ ...valid, slug: "admin" })).toEqual({
      slug: "slugReserved",
    })
  })

  it("needs no password with a Google ticket", () => {
    expect(issues({ ...valid, password: "", googleTicket: "t" })).toEqual({})
  })
})

describe("the school address field", () => {
  it("takes a slug or a pasted address", () => {
    expect(addressToSlug("acme", "lvh.me")).toBe("acme")
    expect(addressToSlug(" ACME.lvh.me ", "lvh.me")).toBe("acme")
    expect(addressToSlug("http://acme.lvh.me:3000/login?x=1", "lvh.me")).toBe(
      "acme"
    )
  })

  it("refuses what can't be a school", () => {
    const schema = schoolAddressSchema("lvh.me")
    expect(schema.safeParse({ address: "acme.lvh.me" }).data).toEqual({
      address: "acme",
    })
    expect(schema.safeParse({ address: "" }).success).toBe(false)
    expect(schema.safeParse({ address: "www" }).success).toBe(false)
    expect(schema.safeParse({ address: "x.acme.lvh.me" }).success).toBe(false)
  })
})
