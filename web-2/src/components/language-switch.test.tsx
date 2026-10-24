import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import bn from "../../messages/bn.json"
import en from "../../messages/en.json"

import { LanguageSwitch } from "./language-switch"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

function renderIn(locale: "bn" | "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "bn" ? bn : en}
    >
      <LanguageSwitch />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  document.cookie = "locale=; path=/; max-age=0"
  refresh.mockClear()
})

describe("LanguageSwitch", () => {
  it("offers the other language and switches to it", async () => {
    renderIn("en")
    const button = screen.getByRole("button", { name: "Switch language" })
    expect(button).toHaveTextContent("বাংলা")

    await userEvent.click(button)

    expect(document.cookie).toContain("locale=bn")
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("labels itself in Bangla when the page is in Bangla", () => {
    renderIn("bn")
    expect(
      screen.getByRole("button", { name: "ভাষা পরিবর্তন করুন" })
    ).toHaveTextContent("English")
  })
})
