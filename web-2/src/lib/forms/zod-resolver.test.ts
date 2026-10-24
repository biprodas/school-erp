import type { ResolverOptions } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { zodResolver } from "./zod-resolver"

const schema = z
  .object({
    identifier: z.string().trim().min(1, "Enter your email or phone"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
    address: z.object({ district: z.string().min(1, "Pick a district") }),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })

const options = {
  fields: {},
  shouldUseNativeValidation: false,
} as ResolverOptions<z.input<typeof schema>>

describe("zodResolver", () => {
  const resolve = zodResolver(schema)

  it("returns the parsed values when valid", async () => {
    const result = await resolve(
      {
        identifier: "  a@b.test ",
        password: "longenough",
        confirm: "longenough",
        address: { district: "d1" },
      },
      undefined,
      options
    )
    expect(result.errors).toEqual({})
    expect(result.values).toMatchObject({ identifier: "a@b.test" })
  })

  it("maps issues to fields, nested paths included, first issue wins", async () => {
    const result = await resolve(
      {
        identifier: "",
        password: "short",
        confirm: "short",
        address: { district: "" },
      },
      undefined,
      options
    )
    expect(result.values).toEqual({})
    expect(result.errors).toMatchObject({
      identifier: { message: "Enter your email or phone" },
      password: { message: "At least 8 characters" },
      address: { district: { message: "Pick a district" } },
    })
  })

  it("reports refinements on their path", async () => {
    const result = await resolve(
      {
        identifier: "a",
        password: "longenough",
        confirm: "different",
        address: { district: "d1" },
      },
      undefined,
      options
    )
    expect(result.errors).toMatchObject({
      confirm: { message: "Passwords don't match" },
    })
  })

  it("puts issues without a path on root", async () => {
    const pathless = z
      .object({ a: z.string(), b: z.string() })
      .refine((v) => v.a || v.b, { message: "Fill in one of them" })
    const result = await zodResolver(pathless)({ a: "", b: "" }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    })
    expect(result.errors).toMatchObject({
      root: { message: "Fill in one of them" },
    })
  })
})
