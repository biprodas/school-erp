import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "../../../messages/en.json"
import type { FormState } from "~/lib/forms/form-state"

import { SignupForm } from "./signup-form"

type Action = (s: FormState, f: FormData) => Promise<FormState>
const { startSignup } = vi.hoisted(() => ({ startSignup: vi.fn<Action>() }))
vi.mock("./actions", () => ({ startSignup }))

/** `GET /api/public/slugs/check` through the BFF; "taken" is taken. */
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const slug = new URL(String(input), "http://x.test").searchParams.get("slug")
  const data =
    slug === "taken"
      ? { slug, available: false, reason: "taken", suggestions: ["taken-bd"] }
      : { slug, available: true, suggestions: [] }
  return Promise.resolve(
    new Response(JSON.stringify({ success: true, data }), {
      headers: { "content-type": "application/json" },
    })
  )
})

function renderForm(
  props: Partial<React.ComponentProps<typeof SignupForm>> = {}
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <SignupForm
          rootDomain="lvh.me"
          initialSchoolName=""
          google={null}
          googleHref={null}
          pageError={null}
          {...props}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  )
}

const slugInput = () => screen.getByLabelText("School address")

beforeEach(() => {
  startSignup.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillOwner() {
  await userEvent.type(screen.getByLabelText("Your name"), "Rina Akter")
  await userEvent.type(screen.getByLabelText("Email"), "rina@example.com")
  await userEvent.type(screen.getByLabelText("Password"), "long-enough")
}

describe("SignupForm", () => {
  it("suggests the address from the name until it is edited", async () => {
    renderForm({ initialSchoolName: "Shapla School" })
    expect(slugInput()).toHaveValue("shapla-school")

    const name = screen.getByLabelText("School name")
    await userEvent.type(name, " Dhaka")
    expect(slugInput()).toHaveValue("shapla-school-dhaka")

    await userEvent.clear(slugInput())
    await userEvent.type(slugInput(), "shapla")
    await userEvent.type(name, "!")
    expect(slugInput()).toHaveValue("shapla")
  })

  it("checks the address live and offers alternatives", async () => {
    renderForm()
    await userEvent.type(slugInput(), "taken")

    expect(
      await screen.findByText("This address is taken.", {}, { timeout: 2000 })
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "taken-bd" }))
    expect(slugInput()).toHaveValue("taken-bd")
    expect(
      await screen.findByText("taken-bd.lvh.me is free", {}, { timeout: 2000 })
    ).toBeInTheDocument()
  })

  it("doesn't ask the backend about addresses the rules refuse", async () => {
    renderForm()
    await userEvent.type(slugInput(), "admin")
    await new Promise((r) => setTimeout(r, 700))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("says to check the email, and can send it again", async () => {
    startSignup.mockResolvedValue({
      status: "success",
      email: "rina@example.com",
    })
    renderForm({ initialSchoolName: "Shapla School" })
    await fillOwner()
    await userEvent.click(screen.getByRole("button", { name: "Create school" }))

    expect(await screen.findByText("Check your email")).toBeInTheDocument()
    const data = startSignup.mock.calls[0][1]
    expect(data.get("slug")).toBe("shapla-school")
    expect(data.get("type")).toBe("school")

    await userEvent.click(
      screen.getByRole("button", { name: "Send the email again" })
    )
    await vi.waitFor(() => expect(startSignup).toHaveBeenCalledTimes(2))
  })

  it("puts a taken address on the slug field, with suggestions", async () => {
    startSignup.mockResolvedValue({
      status: "error",
      code: "SLUG_TAKEN",
      fieldErrors: { slug: "slugTaken" },
      suggestions: ["shapla-school-bd"],
    })
    renderForm({ initialSchoolName: "Shapla School" })
    await fillOwner()
    await userEvent.click(screen.getByRole("button", { name: "Create school" }))

    expect(
      await screen.findByText("This address is taken. Try another.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "shapla-school-bd" })
    ).toBeInTheDocument()
  })

  it("continues after Google without a password", () => {
    renderForm({
      google: { ticket: "tkt", email: "rina@gmail.com", name: "Rina" },
    })
    expect(screen.getByLabelText("Email")).toHaveValue("rina@gmail.com")
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly")
    expect(screen.getByLabelText("Your name")).toHaveValue("Rina")
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument()
  })
})
