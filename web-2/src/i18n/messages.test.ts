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
      // `{name}` and ICU arguments (`{count, plural, …}`), once each.
      [...new Set([...text.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]))].sort()
    for (const path of keys(en)) {
      expect(args(value(catalogs[locale], path)), path).toEqual(
        args(value(en, path))
      )
    }
  })

  it.each(["bn", "hi"] as const)(
    "translate every English sentence in %s",
    (locale) => {
      // Text that stays Latin on purpose: a language's own name, a school
      // address (slugs are ASCII), sample input.
      const latinOnPurpose = new Set([
        "common.languages.en",
        "findSchool.addressPlaceholder",
        "findSchool.emailPlaceholder",
        "signup.slugPlaceholder",
        "signup.emailPlaceholder",
        "signup.schoolNamePlaceholder",
        "auth.login.emailPlaceholder",
        "auth.forgot.emailPlaceholder",
        "onboarding.profile.emailPlaceholder",
        // EIIN is the board's own acronym, written in Latin letters.
        "onboarding.profile.eiin",
        "onboarding.finish.details.eiin",
      ])
      const at = (messages: object, path: string) =>
        path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)[key],
            messages
          ) as string
      const untranslated = keys(en).filter((path) => {
        const english = at(en, path)
        return (
          !latinOnPurpose.has(path) &&
          at(catalogs[locale], path) === english &&
          /[A-Za-z]{3,}/.test(english.replace(/\{[^}]*\}/g, ""))
        )
      })
      expect(untranslated).toEqual([])
    }
  )

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
