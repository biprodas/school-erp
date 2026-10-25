import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "../../../../messages/en.json"
import type { FormState } from "~/lib/forms/form-state"

import { SignupForm } from "./signup-form"

type Action = (s: FormState, f: FormData) => Promise<FormState>
const { startSignup } = vi.hoisted(() => ({ startSignup: vi.fn<Action>() }))
vi.mock("../actions", () => ({ startSignup }))

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
/** Opens the address field, folded into a line until "Change". */
const changeSlug = () =>
  userEvent.click(screen.getByRole("button", { name: "Change" }))

beforeEach(() => {
  startSignup.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillOwner() {
  await userEvent.type(screen.getByLabelText("Your name"), "John Doe")
  await userEvent.type(screen.getByLabelText("Email"), "rina@example.com")
  await userEvent.type(screen.getByLabelText("Password"), "long-enough")
}

describe("SignupForm", () => {
  it("checks a field once something is typed in it, not when it's only visited", async () => {
    renderForm()
    const name = screen.getByLabelText("School name")
    await userEvent.click(name)
    await userEvent.click(screen.getByLabelText("Your name"))
    await userEvent.tab()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    await userEvent.type(name, "Sh")
    expect(
      await screen.findByText("School name needs at least 3 characters")
    ).toBeInTheDocument()
    await userEvent.type(name, "a")
    await waitFor(() =>
      expect(
        screen.queryByText("School name needs at least 3 characters")
      ).not.toBeInTheDocument()
    )
    await userEvent.clear(name)
    expect(
      await screen.findByText("School name is required")
    ).toBeInTheDocument()
    // The other fields were never typed in, so they stay quiet.
    expect(screen.queryByText("Your name is required")).not.toBeInTheDocument()
  })

  it("suggests the address from the name until it is edited", async () => {
    renderForm({ initialSchoolName: "Shapla School" })
    expect(screen.getByText("shapla-school.lvh.me")).toBeInTheDocument()
    expect(slugInput()).not.toBeVisible()

    const name = screen.getByLabelText("School name")
    await userEvent.type(name, " Dhaka")
    expect(screen.getByText("shapla-school-dhaka.lvh.me")).toBeInTheDocument()

    await changeSlug()
    expect(slugInput()).toBeVisible()
    expect(slugInput()).toHaveFocus()
    expect(slugInput()).toHaveValue("shapla-school-dhaka")
    await userEvent.clear(slugInput())
    await userEvent.type(slugInput(), "shapla")
    await userEvent.type(name, "!")
    expect(slugInput()).toHaveValue("shapla")
  })

  it("says only when the folded address is taken, and offers alternatives", async () => {
    renderForm({ initialSchoolName: "Shapla School" })
    await new Promise((r) => setTimeout(r, 700))
    expect(screen.queryByText(/is free/)).not.toBeInTheDocument()

    const name = screen.getByLabelText("School name")
    await userEvent.clear(name)
    await userEvent.type(name, "Taken")
    expect(
      await screen.findByText("This address is taken.", {}, { timeout: 2000 })
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "taken-bd" }))
    expect(screen.getByText("taken-bd.lvh.me")).toBeInTheDocument()
    expect(slugInput()).not.toBeVisible()
  })

  it("folds the address back into its line with Done", async () => {
    renderForm({ initialSchoolName: "Shapla School" })
    await changeSlug()
    await userEvent.clear(slugInput())
    await userEvent.type(slugInput(), "shapla")
    await userEvent.click(screen.getByRole("button", { name: "Done" }))

    expect(slugInput()).not.toBeVisible()
    expect(screen.getByText("shapla.lvh.me")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Change" })).toHaveFocus()
  })

  it("checks the address live and offers alternatives", async () => {
    renderForm()
    await changeSlug()
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
    await changeSlug()
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
    // The kind of institution is asked in onboarding.
    expect(data.has("type")).toBe(false)

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
    // The refused address opens its field, ready to change.
    expect(slugInput()).toBeVisible()
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
