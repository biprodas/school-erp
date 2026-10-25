import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"

import bn from "../../../messages/bn.json"
import en from "../../../messages/en.json"
import type { FormState } from "~/lib/forms/form-state"

import { ActivateForm } from "./activate-form"
import { LoginForm } from "./login-form"

type Action = (s: FormState, f: FormData) => Promise<FormState>
const { signIn, activate } = vi.hoisted(() => ({
  signIn: vi.fn<Action>(),
  activate: vi.fn<Action>(),
}))

// The real actions are server code; the forms only need their answers.
vi.mock("./actions", () => ({ signIn, activate }))

function renderIn(ui: React.ReactNode, locale: "en" | "bn" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "bn" ? bn : en}
      timeZone="Asia/Dhaka"
    >
      {ui}
    </NextIntlClientProvider>
  )
}

const loginForm = (
  props: Partial<React.ComponentProps<typeof LoginForm>> = {}
) => (
  <LoginForm
    next={null}
    googleHref={null}
    pageError={null}
    notice={null}
    {...props}
  />
)

async function submitLogin() {
  await userEvent.type(screen.getByLabelText("Email or phone"), "01712345678")
  await userEvent.type(screen.getByLabelText("Password"), "secret")
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }))
}

beforeEach(() => {
  signIn.mockReset()
  activate.mockReset()
})

describe("LoginForm", () => {
  it.each([
    [
      "INVALID_CREDENTIALS",
      "That email or phone number and password don't match an account at this school.",
    ],
    [
      "ACCOUNT_PENDING",
      "This account isn't verified yet. Use the link in your invitation or verification email.",
    ],
    [
      "MEMBERSHIP_PENDING",
      "Your invitation hasn't been accepted yet. Open the activation link in your invitation email.",
    ],
    ["TOO_MANY_REQUESTS", "Too many attempts. Wait a minute and try again."],
    ["SOMETHING_ELSE", "Something went wrong. Please try again."],
  ])("shows the message for %s", async (code, message) => {
    signIn.mockResolvedValue({ status: "error", code })
    renderIn(loginForm())

    await submitLogin()

    expect(await screen.findByRole("alert")).toHaveTextContent(message)
  })

  it("shows when a locked account opens again", async () => {
    signIn.mockResolvedValue({
      status: "error",
      code: "ACCOUNT_LOCKED",
      lockedUntil: "2026-10-25T04:15:00.000Z",
    })
    renderIn(loginForm())

    await submitLogin()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You can try again after 25/10/2026 10:15 AM."
    )
  })

  it("sends the identifier, password and next to the action", async () => {
    signIn.mockResolvedValue({ status: "error", code: "INVALID_CREDENTIALS" })
    renderIn(loginForm({ next: "/dashboard/fees" }))

    await submitLogin()

    await screen.findByRole("alert")
    const data = signIn.mock.calls[0][1]
    expect(data.get("identifier")).toBe("01712345678")
    expect(data.get("password")).toBe("secret")
    expect(data.get("next")).toBe("/dashboard/fees")
  })

  it("checks the fields before calling the backend", async () => {
    renderIn(loginForm())

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText("Enter your email or phone number")
    ).toBeInTheDocument()
    expect(screen.getByText("Enter a password")).toBeInTheDocument()
    expect(screen.getByLabelText("Email or phone")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(signIn).not.toHaveBeenCalled()
  })

  it("shows an error from the URL, and the Google button when enabled", () => {
    renderIn(loginForm({ pageError: "handoff", googleHref: "/auth/google" }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That sign-in link has expired or was already used."
    )
    expect(
      screen.getByRole("link", { name: "Continue with Google" })
    ).toHaveAttribute("href", "/auth/google")
  })

  it("has no Google button when Google is off", () => {
    renderIn(loginForm())
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument()
  })

  it("speaks Bangla", async () => {
    signIn.mockResolvedValue({ status: "error", code: "INVALID_CREDENTIALS" })
    renderIn(loginForm(), "bn")

    await userEvent.type(screen.getByLabelText("ইমেইল বা ফোন"), "x@y.test")
    await userEvent.type(screen.getByLabelText("পাসওয়ার্ড"), "secret")
    await userEvent.click(screen.getByRole("button", { name: "সাইন ইন" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "এই ইমেইল বা ফোন নম্বর ও পাসওয়ার্ডের সাথে"
    )
  })
})

describe("ActivateForm", () => {
  it("asks a new account to choose and confirm a password", async () => {
    activate.mockResolvedValue({ status: "error", code: "BAD_REQUEST" })
    renderIn(<ActivateForm token="tok" hasPassword={false} />)

    expect(screen.getByLabelText("New password")).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("New password"), "abcdef")
    await userEvent.type(screen.getByLabelText("Confirm password"), "abcdeg")
    await userEvent.click(
      screen.getByRole("button", { name: "Activate and sign in" })
    )
    expect(
      await screen.findByText("The passwords don't match")
    ).toBeInTheDocument()
    expect(activate).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText("Confirm password"))
    await userEvent.type(screen.getByLabelText("Confirm password"), "abcdef")
    await userEvent.click(
      screen.getByRole("button", { name: "Activate and sign in" })
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This link is invalid, already used or expired."
    )
    const data = activate.mock.calls[0][1]
    expect(data.get("token")).toBe("tok")
    expect(data.get("mode")).toBe("new")
    expect(data.get("password")).toBe("abcdef")
  })

  it("rejects a password shorter than the backend allows", async () => {
    renderIn(<ActivateForm token="tok" hasPassword={false} />)

    await userEvent.type(screen.getByLabelText("New password"), "abc")
    await userEvent.type(screen.getByLabelText("Confirm password"), "abc")
    await userEvent.click(
      screen.getByRole("button", { name: "Activate and sign in" })
    )

    expect(
      await screen.findByText("Use at least 6 characters")
    ).toBeInTheDocument()
  })

  it("asks an account with a password for that password", async () => {
    activate.mockResolvedValue({ status: "error", code: "INVALID_CREDENTIALS" })
    renderIn(<ActivateForm token="tok" hasPassword />)

    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Password"), "mine")
    await userEvent.click(
      screen.getByRole("button", { name: "Accept and sign in" })
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "don't match an account"
    )
    expect(activate.mock.calls[0][1].get("mode")).toBe("existing")
  })
})
