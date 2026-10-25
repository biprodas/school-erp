import { describe, expect, it } from "vitest"

import bn from "../../messages/bn.json"
import en from "../../messages/en.json"
import hi from "../../messages/hi.json"

import { LOCALES } from "./config"

const catalogs = { en, bn, hi }

/** Every leaf key as a dotted path: `common.languages.bn`. */
function keys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

describe("message catalogs", () => {
  it("exist for every locale", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...LOCALES].sort())
  })

  it.each(["bn", "hi"] as const)(
    "have the same keys in %s and English",
    (locale) => {
      expect(keys(catalogs[locale]).sort()).toEqual(keys(en).sort())
    }
  )

  it.each(["bn", "hi"] as const)("keep every {placeholder} in %s", (locale) => {
    const value = (messages: object, path: string) =>
      path
        .split(".")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          messages
        ) as string
    const args = (text: string) =>
      [...text.matchAll(/{(w+)}/g)].map((m) => m[1]).sort()
    for (const path of keys(en)) {
      expect(args(value(catalogs[locale], path)), path).toEqual(
        args(value(en, path))
      )
    }
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
    for (const messages of Object.values(catalogs)) {
      expect(empty(messages)).toEqual([])
    }
  })
})
