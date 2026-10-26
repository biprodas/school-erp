import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"

import en from "../../../../messages/en.json"
import { SwitchAccount } from "./switch-account"

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock("../sign-out", () => ({ signOut }))

describe("SwitchAccount", () => {
  it("names both accounts and signs out back to the same link", async () => {
    window.history.replaceState(null, "", "/activate?token=tok")
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SwitchAccount current="rafiq@school.test" invitee="rina@school.test" />
      </NextIntlClientProvider>
    )

    expect(screen.getByText("rafiq@school.test").tagName).toBe("STRONG")
    expect(screen.getByText("rina@school.test").tagName).toBe("STRONG")
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out and continue" })
    )
    expect(signOut).toHaveBeenCalledWith({ to: "/activate?token=tok" })
  })
})
