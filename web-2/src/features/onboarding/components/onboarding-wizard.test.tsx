import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "../../../../messages/en.json"
import type { SchoolClass, Section } from "~/features/academics/api"
import type {
  FeeHead,
  GradingSystem,
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

const BANDS = [
  { letter: "A+", minPercent: 80, maxPercent: 100, point: 5, isFail: false },
  { letter: "F", minPercent: 0, maxPercent: 32, point: 0, isFail: true },
]

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
      bands: BANDS,
    },
    {
      code: "gpa-4",
      name: "GPA 4.0",
      description: "Four-point scale",
      kind: "gpa",
      scale: 4,
      bands: BANDS.map((b) => ({ ...b, point: Math.min(b.point, 4) })),
    },
  ],
  feeHeads: {
    items: [
      { name: "Admission Fee", frequency: "once" },
      { name: "Tuition Fee", frequency: "monthly" },
    ],
  },
  holidays: { code: "bd", fixed: [], movable: [] },
}

interface Call {
  method: string
  path: string
  body: unknown
}

interface State {
  checklist: OnboardingChecklist
  /** A current session with these classes and sections, if any. */
  academics?: { classes: SchoolClass[]; sections: Section[] }
  gradingSystems?: GradingSystem[]
  feeHeads?: FeeHead[]
}

/** A backend by path; `state.checklist` is what the checklist answers. */
function backend(state: State) {
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
      "PATCH /api/settings/organization": {},
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
    const grading = /^\/api\/onboarding\/templates\/grading\/(.+)\/apply$/.exec(
      url.pathname
    )
    const heads = (state.feeHeads ??= [])
    const feeHead = (name: string, frequency: FeeHead["frequency"]) => {
      const head: FeeHead = {
        id: `h${heads.length + 1}`,
        name,
        nameBn: null,
        frequency,
        isActive: true,
        sortOrder: heads.length,
      }
      heads.push(head)
      return head
    }
    if (key === "GET /api/fee-heads") {
      return reply(200, { success: true, data: heads })
    }
    if (key === "POST /api/fee-heads") {
      const head = feeHead(body.name, body.frequency)
      return reply(200, { success: true, data: head })
    }
    if (key === "POST /api/onboarding/templates/fee-heads/apply") {
      const missing = TEMPLATES.feeHeads.items.filter(
        (item) => !heads.some((h) => h.name === item.name)
      )
      for (const item of missing) {
        feeHead(
          item.name,
          item.frequency === "monthly" ? "monthly" : "one_time"
        )
      }
      return reply(200, {
        success: true,
        data: { created: missing.length, skipped: 0 },
      })
    }
    if (method === "DELETE" && url.pathname.startsWith("/api/fee-heads/")) {
      const id = url.pathname.split("/").pop()
      state.feeHeads = heads.filter((h) => h.id !== id)
      return reply(200, { success: true, data: null })
    }
    if (key === "GET /api/grading-systems") {
      return reply(200, { success: true, data: state.gradingSystems ?? [] })
    }
    if (method === "POST" && grading) {
      const template = TEMPLATES.grading.find((g) => g.code === grading[1])!
      const systems = (state.gradingSystems ??= [])
      const gradingSystem: GradingSystem = {
        id: `g-${template.code}`,
        name: template.name,
        kind: template.kind,
        templateCode: template.code,
        isDefault: systems.length === 0,
        items: template.bands.map((b, i) => ({
          ...b,
          id: `b${i}`,
          sortOrder: i,
        })),
      }
      systems.push(gradingSystem)
      return reply(200, {
        success: true,
        data: { gradingSystem, created: true },
      })
    }
    const academics = state.academics
    if (academics) {
      const page = (items: unknown[]) =>
        reply(200, {
          success: true,
          data: items,
          meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
        })
      if (key === "GET /api/academic-years/current") {
        return reply(200, { success: true, data: SESSION })
      }
      if (key === "GET /api/classes") return page(academics.classes)
      if (key === "GET /api/sections") return page(academics.sections)
      const [, kind, id] =
        url.pathname.match(/^\/api\/(classes|sections)\/(.+)$/) ?? []
      if (method === "DELETE" && kind === "sections") {
        academics.sections = academics.sections.filter((s) => s.id !== id)
        return reply(200, { success: true, data: null })
      }
      if (method === "DELETE" && kind === "classes") {
        academics.classes = academics.classes.filter((c) => c.id !== id)
        academics.sections = academics.sections.filter((s) => s.classId !== id)
        return reply(200, { success: true, data: null })
      }
    }
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

const SESSION = {
  id: "y1",
  name: "2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  isCurrent: true,
}
const schoolClass = (id: string, name: string): SchoolClass => ({
  id,
  name,
  code: null,
  level: null,
  isActive: true,
})
const section = (id: string, classId: string, name: string): Section => ({
  id,
  academicYearId: "y1",
  classId,
  name,
  capacity: null,
  isActive: true,
})

let state: State
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
    expect(profile.getAttribute("aria-current")).toBeNull()
    expect(within(profile).getByText("Done")).toBeTruthy()
    const session = stepButton(/Academic session/)
    expect(session.getAttribute("aria-current")).toBe("step")
    expect(
      screen.getByRole("region", { name: "Academic session" })
    ).toBeTruthy()
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
      expect(stepButton(/Academic session/).getAttribute("aria-current")).toBe(
        "step"
      )
    )
  })

  it("asks the kind of institution and saves a change on the organization", async () => {
    renderWizard()
    const panel = await screen.findByRole("region", { name: "School profile" })
    const kind = await within(panel).findByLabelText("Kind of institution")
    expect(kind).toHaveValue("madrasa")

    await userEvent.selectOptions(kind, "college")
    await userEvent.type(within(panel).getByLabelText("District"), "Dhaka")
    await userEvent.type(within(panel).getByLabelText("Phone"), "01712345678")
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save and continue" })
    )

    await waitFor(() =>
      expect(
        api.calls
          .filter((c) => c.method === "PATCH")
          .map((c) => [c.path, c.body])
      ).toEqual([
        ["/api/settings/organization", { type: "college" }],
        [
          "/api/settings/profile",
          {
            address: { line1: null, district: "Dhaka" },
            phone: "01712345678",
            email: null,
          },
        ],
      ])
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

  it("removes a section, and a class after confirming", async () => {
    state.checklist = checklist(["profile", "session"])
    state.academics = {
      classes: [schoolClass("c6", "Class 6"), schoolClass("c7", "Class 7")],
      sections: [section("s1", "c6", "A"), section("s2", "c6", "B")],
    }
    renderWizard()
    const panel = await screen.findByRole("region", {
      name: "Classes and sections",
    })

    await userEvent.click(
      await within(panel).findByRole("button", {
        name: "Remove section B of Class 6",
      })
    )
    await waitFor(() =>
      expect(within(panel).queryByText("Section B")).toBeNull()
    )
    expect(
      api.calls.some(
        (c) => c.method === "DELETE" && c.path === "/api/sections/s2"
      )
    ).toBe(true)

    await userEvent.click(
      within(panel).getByRole("button", { name: "Remove Class 7" })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText("Remove Class 7?")).toBeTruthy()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Remove class" })
    )
    await waitFor(() => expect(within(panel).queryByText("Class 7")).toBeNull())
    expect(
      api.calls.some(
        (c) => c.method === "DELETE" && c.path === "/api/classes/c7"
      )
    ).toBe(true)
  })

  it("shows the grading system a template added, as the default, with its grades", async () => {
    state.checklist = checklist(REQUIRED)
    renderWizard()
    const panel = await screen.findByRole("region", { name: "Grading system" })
    expect(await within(panel).findByText(/No grading system yet/)).toBeTruthy()

    await userEvent.click(
      await within(panel).findByRole("button", {
        name: "Use this: Bangladesh GPA 5.0",
      })
    )

    const scale = await within(panel).findByRole("list", {
      name: "Grades in Bangladesh GPA 5.0",
    })
    expect(within(scale).getByText("80–100%")).toBeTruthy()
    expect(within(panel).getByText("Default")).toBeTruthy()
    expect(within(panel).getByText("GPA out of 5")).toBeTruthy()
    // Added already: no button for it, only for the other one.
    expect(
      within(panel).queryByRole("button", {
        name: "Use this: Bangladesh GPA 5.0",
      })
    ).toBeNull()
    expect(
      within(panel).getByRole("button", { name: "Use this: GPA 4.0" })
    ).toBeTruthy()
  })

  it("adds the missing common fee heads and the school's own, and removes one", async () => {
    state.checklist = checklist(REQUIRED)
    state.feeHeads = []
    renderWizard()
    await userEvent.click(
      await screen.findByRole("button", { name: /Fee heads/ })
    )
    const panel = await screen.findByRole("region", { name: "Fee heads" })
    expect(await within(panel).findByText(/No fee heads yet/)).toBeTruthy()

    await userEvent.click(
      await within(panel).findByRole("button", { name: "Add all 2" })
    )
    const list = await within(panel).findByRole("list", {
      name: "Your fee heads",
    })
    expect(within(list).getByText("Tuition Fee")).toBeTruthy()
    expect(within(list).getByText("Monthly")).toBeTruthy()
    expect(within(panel).getByText("All added")).toBeTruthy()

    await userEvent.type(
      within(panel).getByLabelText("Fee head name"),
      "Computer Fee"
    )
    await userEvent.selectOptions(
      within(panel).getByLabelText("How often it is billed"),
      "yearly"
    )
    await userEvent.click(within(panel).getByRole("button", { name: "Add" }))
    await waitFor(() =>
      expect(
        api.calls.find(
          (c) => c.method === "POST" && c.path === "/api/fee-heads"
        )?.body
      ).toEqual({ name: "Computer Fee", frequency: "yearly" })
    )
    expect(await within(list).findByText("Computer Fee")).toBeTruthy()

    await userEvent.click(
      within(list).getByRole("button", { name: "Remove Tuition Fee" })
    )
    await waitFor(() =>
      expect(within(list).queryByText("Tuition Fee")).toBeNull()
    )
    // Missing again from the common set.
    expect(
      within(panel).getByRole("button", { name: "Add the missing one" })
    ).toBeTruthy()
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

  it("skips an optional step and goes back from the step's footer", async () => {
    state.checklist = checklist(REQUIRED)
    renderWizard()
    const grading = await screen.findByRole("region", {
      name: "Grading system",
    })
    expect(within(grading).getByText(/Step 5 of 8/)).toBeTruthy()

    await userEvent.click(
      within(grading).getByRole("button", { name: "Skip this step" })
    )
    expect(stepButton(/Fee heads/).getAttribute("aria-current")).toBe("step")

    await userEvent.click(
      within(screen.getByRole("region", { name: "Fee heads" })).getByRole(
        "button",
        { name: "Back" }
      )
    )
    expect(stepButton(/Grading system/).getAttribute("aria-current")).toBe(
      "step"
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
