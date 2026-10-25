import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "../../../../messages/en.json"
import type {
  OnboardingChecklist,
  OnboardingStepKey,
  OnboardingTemplates,
} from "~/features/onboarding/api"
import { settingsKeys, type DisplaySettings } from "~/features/settings/api"

import { OnboardingWizard } from "./onboarding-wizard"

const actions = vi.hoisted(() => ({
  completeOnboarding: vi.fn(async () => ({ status: "idle" as const })),
  skipOnboarding: vi.fn(async () => ({ status: "idle" as const })),
}))
vi.mock("../actions", () => actions)

const DISPLAY: DisplaySettings = {
  name: "Acme School",
  nameBn: null,
  logoUrl: null,
  colors: { primary: null, secondary: null },
  locale: {
    language: "en",
    dateFormat: "DD/MM/YYYY",
    numerals: "en",
    currency: "BDT",
    timeZone: "Asia/Dhaka",
    weekStart: "saturday",
    weekendDays: ["friday"],
  },
}

const REQUIRED: OnboardingStepKey[] = [
  "profile",
  "session",
  "classes",
  "curriculum",
]
const ALL: OnboardingStepKey[] = [
  ...REQUIRED,
  "grading",
  "fees",
  "staff",
  "students",
]

const checklist = (
  done: OnboardingStepKey[],
  completedAt: string | null = null
): OnboardingChecklist => ({
  steps: ALL.map((key) => ({
    key,
    title: key,
    link: `/${key}`,
    required: REQUIRED.includes(key),
    available: true,
    done: done.includes(key),
  })),
  percentage: Math.round((done.length / ALL.length) * 100),
  canComplete: REQUIRED.every((key) => done.includes(key)),
  completedAt,
})

const TEMPLATES: OnboardingTemplates = {
  curriculum: [
    {
      code: "nctb",
      name: "NCTB (Bangladesh national curriculum)",
      description: "Classes 1–10",
      suggestedFor: ["school"],
      classes: ["Class 1", "Class 2"],
      subjects: 20,
      groups: [],
    },
    {
      code: "alia-madrasa",
      name: "Alia madrasa (Ebtedayee and Dakhil)",
      description: "Ebtedayee and Dakhil",
      suggestedFor: ["madrasa"],
      classes: ["Class 1"],
      subjects: 25,
      groups: [],
    },
  ],
  grading: [
    {
      code: "bd-gpa-5",
      name: "Bangladesh GPA 5.0",
      description: "SSC/HSC scale",
      kind: "gpa",
      scale: 5,
    },
  ],
  feeHeads: { items: [{ name: "Tuition Fee", frequency: "monthly" }] },
  holidays: { code: "bd", fixed: [], movable: [] },
}

interface Call {
  method: string
  path: string
  body: unknown
}

/** A backend by path; `state.checklist` is what the checklist answers. */
function backend(state: { checklist: OnboardingChecklist }) {
  const calls: Call[] = []
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://x.test")
    const method = init?.method ?? "GET"
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined
    calls.push({ method, path: url.pathname, body })

    const answers: Record<string, unknown> = {
      "GET /api/onboarding/checklist": state.checklist,
      "GET /api/onboarding/templates": TEMPLATES,
      "GET /api/settings": {
        organization: {
          id: "o1",
          name: "Acme",
          slug: "acme",
          type: "madrasa",
          eiin: null,
        },
        profile: {
          nameBn: null,
          address: {
            line1: null,
            line2: null,
            area: null,
            district: null,
            postCode: null,
          },
          phone: null,
          email: null,
        },
      },
      "PATCH /api/settings/profile": {},
      "POST /api/academic-years": {
        id: "y1",
        name: body?.name,
        startDate: body?.startDate,
        endDate: body?.endDate,
        isCurrent: true,
      },
      "POST /api/onboarding/templates/curriculum/alia-madrasa/apply": {
        template: "alia-madrasa",
        academicYearId: "y1",
        created: {
          subjects: 25,
          classes: 10,
          subjectGroups: 0,
          groupSubjects: 0,
          classSubjects: 120,
          components: 0,
          classSubjectGroups: 0,
        },
      },
    }
    const key = `${method} ${url.pathname}`
    if (key === "GET /api/academic-years/current") {
      return reply(404, {
        success: false,
        statusCode: 404,
        message: "No academic session is marked current",
        code: "NO_CURRENT_SESSION",
      })
    }
    return key in answers
      ? reply(200, { success: true, data: answers[key] })
      : reply(500, { success: false, statusCode: 500, code: "INTERNAL" })
  })
  return { fetch, calls }
}

const reply = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )

function renderWizard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(settingsKeys.display, DISPLAY)
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <OnboardingWizard />
      </NextIntlClientProvider>
    </QueryClientProvider>
  )
}

const stepButton = (name: RegExp) => screen.getByRole("button", { name })

let state: { checklist: OnboardingChecklist }
let api: ReturnType<typeof backend>

beforeEach(() => {
  state = { checklist: checklist([]) }
  api = backend(state)
  vi.stubGlobal("fetch", api.fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("OnboardingWizard", () => {
  it("lists the steps with their state and opens the first one to do", async () => {
    state.checklist = checklist(["profile", "grading"])
    renderWizard()

    const profile = await screen.findByRole("button", {
      name: /School profile/,
    })
    expect(profile.getAttribute("aria-expanded")).toBe("false")
    expect(within(profile).getByText("Done")).toBeTruthy()
    const session = stepButton(/Academic session/)
    expect(session.getAttribute("aria-expanded")).toBe("true")
    expect(within(session).getByText("Required")).toBeTruthy()
    expect(within(stepButton(/Fee heads/)).getByText("Optional")).toBeTruthy()

    const finish = screen.getByRole("region", { name: "Finish setup" })
    expect(
      within(finish).getByText(
        /Still required: Academic session, Classes and sections, Subjects for each class/
      )
    ).toBeTruthy()
    expect(
      (
        within(finish).getByRole("button", {
          name: "Finish setup",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it("checks the profile, saves it and refetches the checklist", async () => {
    renderWizard()
    const panel = await screen.findByRole("region", { name: "School profile" })
    const save = await within(panel).findByRole("button", {
      name: "Save and continue",
    })

    await userEvent.click(save)
    expect(
      within(panel).getByText("Enter an address or a district")
    ).toBeTruthy()
    expect(
      within(panel).getByText("Enter a phone number or an email")
    ).toBeTruthy()

    await userEvent.type(within(panel).getByLabelText("District"), "Dhaka")
    await userEvent.type(within(panel).getByLabelText("Phone"), "01712345678")
    const checklistReads = () =>
      api.calls.filter((c) => c.path === "/api/onboarding/checklist").length
    const before = checklistReads()
    state.checklist = checklist(["profile"])
    await userEvent.click(save)

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === "PATCH")?.body).toEqual({
        address: { line1: null, district: "Dhaka" },
        phone: "01712345678",
        email: null,
      })
    )
    await waitFor(() => expect(checklistReads()).toBeGreaterThan(before))
    // On to the next step to do.
    await waitFor(() =>
      expect(stepButton(/Academic session/).getAttribute("aria-expanded")).toBe(
        "true"
      )
    )
  })

  it("creates the current session for this calendar year", async () => {
    state.checklist = checklist(["profile"])
    renderWizard()
    const panel = await screen.findByRole("region", {
      name: "Academic session",
    })
    await userEvent.click(
      await within(panel).findByRole("button", { name: "Create session" })
    )
    const year = new Date().getFullYear()
    await waitFor(() =>
      expect(
        api.calls.find((c) => c.path === "/api/academic-years")?.body
      ).toEqual({
        name: String(year),
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        isCurrent: true,
      })
    )
  })

  it("suggests the school type's curriculum first and applies it", async () => {
    state.checklist = checklist(["profile", "session", "classes"])
    renderWizard()
    const panel = await screen.findByRole("region", {
      name: "Subjects for each class",
    })
    const list = await within(panel).findByRole("list", {
      name: "Curriculum templates",
    })
    const items = within(list).getAllByRole("listitem")
    expect(items[0]!.textContent).toContain("Alia madrasa")
    expect(within(items[0]!).getByText("Suggested")).toBeTruthy()

    await userEvent.click(
      within(items[0]!).getByRole("button", { name: /Use this template/ })
    )
    await waitFor(() =>
      expect(
        api.calls.some(
          (c) =>
            c.method === "POST" &&
            c.path === "/api/onboarding/templates/curriculum/alia-madrasa/apply"
        )
      ).toBe(true)
    )
  })

  it("finishes once every required step is done, or skips", async () => {
    state.checklist = checklist(REQUIRED)
    renderWizard()
    const finish = await screen.findByRole("region", { name: "Finish setup" })
    expect(within(finish).getByText(/The required steps are done/)).toBeTruthy()

    await userEvent.click(
      within(finish).getByRole("button", { name: "Finish setup" })
    )
    await waitFor(() => expect(actions.completeOnboarding).toHaveBeenCalled())

    await userEvent.click(
      within(finish).getByRole("button", { name: "Skip for now" })
    )
    await waitFor(() => expect(actions.skipOnboarding).toHaveBeenCalled())
  })

  it("only links to the dashboard once setup is finished", async () => {
    state.checklist = checklist(REQUIRED, "2026-10-25T08:00:00.000Z")
    renderWizard()
    const finish = await screen.findByRole("region", { name: "Finish setup" })
    expect(
      within(finish)
        .getByRole("link", { name: "Go to dashboard" })
        .getAttribute("href")
    ).toBe("/dashboard")
    expect(within(finish).queryByRole("button")).toBeNull()
  })
})
