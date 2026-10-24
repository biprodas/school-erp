import { describe, expect, it } from "vitest"

import bn from "../../messages/bn.json"
import en from "../../messages/en.json"

/** Every leaf key as a dotted path: `common.languages.bn`. */
function keys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

describe("message catalogs", () => {
  it("have the same keys in Bangla and English", () => {
    expect(keys(bn).sort()).toEqual(keys(en).sort())
  })

  it("have no empty strings", () => {
    const empty = (messages: object) =>
      keys(messages).filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)[key],
            messages
          )
        return typeof value !== "string" || value.trim() === ""
      })
    expect(empty(en)).toEqual([])
    expect(empty(bn)).toEqual([])
  })
})
