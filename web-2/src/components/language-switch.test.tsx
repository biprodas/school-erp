import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import bn from "../../messages/bn.json"
import en from "../../messages/en.json"
import hi from "../../messages/hi.json"

import { LanguageSwitch } from "./language-switch"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

const catalogs = { en, bn, hi }

function renderIn(locale: keyof typeof catalogs) {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      <LanguageSwitch />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  document.cookie = "locale=; path=/; max-age=0"
  refresh.mockClear()
})

describe("LanguageSwitch", () => {
  it("shows the current language and offers all three", async () => {
    renderIn("en")
    const trigger = screen.getByRole("button", { name: "Switch language" })
    expect(trigger).toHaveTextContent("English")

    await userEvent.click(trigger)

    const options = await screen.findAllByRole("menuitemradio")
    expect(options.map((o) => o.textContent)).toEqual([
      "English",
      "বাংলা",
      "हिन्दी",
    ])
  })

  it("switches to Hindi", async () => {
    renderIn("en")
    await userEvent.click(
      screen.getByRole("button", { name: "Switch language" })
    )
    await userEvent.click(
      await screen.findByRole("menuitemradio", { name: "हिन्दी" })
    )

    expect(document.cookie).toContain("locale=hi")
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("labels itself in the page's language", () => {
    renderIn("bn")
    expect(
      screen.getByRole("button", { name: "ভাষা পরিবর্তন করুন" })
    ).toHaveTextContent("বাংলা")

    renderIn("hi")
    expect(
      screen.getByRole("button", { name: "भाषा बदलें" })
    ).toHaveTextContent("हिन्दी")
  })
})
