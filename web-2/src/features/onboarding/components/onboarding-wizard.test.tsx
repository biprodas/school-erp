import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "../../../../messages/en.json"
import type {
  ClassSubject,
  SchoolClass,
  Section,
} from "~/features/academics/api"
import type {
  FeeHead,
  GradingSystem,
  OnboardingChecklist,
  OnboardingStepKey,
  StaffMember,
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
  "curriculum",
  "classes",
]
const ALL: OnboardingStepKey[] = [...REQUIRED, "grading", "fees", "staff"]

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

const TEMPLATES: Omit<OnboardingTemplates, "curriculumInUse"> = {
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
  holidays: {
    code: "bd",
    fixed: [
      {
        name: "Language Martyrs' Day",
        nameBn: "শহীদ দিবস",
        type: "public",
        month: 2,
        day: 21,
      },
      {
        name: "Independence Day",
        nameBn: "স্বাধীনতা দিবস",
        type: "public",
        month: 3,
        day: 26,
      },
    ],
    movable: [{ name: "Eid ul-Fitr", nameBn: "ঈদুল ফিতর", type: "religious" }],
  },
}

interface Call {
  method: string
  path: string
  body: unknown
}

interface State {
  checklist: OnboardingChecklist
  /** A current session with these classes and sections, if any. */
  academics?: {
    classes: SchoolClass[]
    sections: Section[]
    classSubjects?: ClassSubject[]
  }
  gradingSystems?: GradingSystem[]
  feeHeads?: FeeHead[]
  /** Staff records. */
  staff?: StaffMember[]
  /** The curriculum template the school uses. */
  curriculumInUse?: string | null
  /** Holidays in the school's calendar. */
  holidays?: {
    id?: string
    name: string
    dateFrom: string
    dateTo?: string
    type?: string
  }[]
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
      "GET /api/onboarding/templates": {
        ...TEMPLATES,
        curriculumInUse: state.curriculumInUse ?? null,
      },
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
      "POST /api/onboarding/templates/curriculum/alia-madrasa/switch": {
        template: "alia-madrasa",
        academicYearId: "y1",
        previous: "nctb",
        removed: {
          classes: 1,
          subjects: 2,
          subjectGroups: 0,
          classSubjects: 1,
        },
        created: {
          subjects: 25,
          classes: 0,
          subjectGroups: 0,
          groupSubjects: 0,
          classSubjects: 120,
          components: 0,
          classSubjectGroups: 0,
        },
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
    const staff = (state.staff ??= [])
    if (key === "GET /api/roles") {
      return reply(200, {
        success: true,
        data: [
          {
            id: "r-acc",
            name: "accountant",
            isSystem: true,
            permissions: ["fees:read"],
          },
          {
            id: "r-guard",
            name: "guardian",
            isSystem: true,
            permissions: ["portal:access"],
          },
          {
            id: "r-teach",
            name: "teacher",
            isSystem: true,
            permissions: ["attendance:take"],
          },
        ],
      })
    }
    if (key === "GET /api/employees") {
      return reply(200, {
        success: true,
        data: staff,
        meta: { page: 1, limit: 100, total: staff.length, totalPages: 1 },
      })
    }
    if (key === "POST /api/employees") {
      const created: StaffMember = {
        id: `e${staff.length + 1}`,
        employeeNumber: `EMP-00${staff.length + 1}`,
        firstName: body.firstName,
        lastName: body.lastName,
        fullName: `${body.firstName} ${body.lastName}`,
        email: body.email ?? null,
        phone: body.phone ?? null,
        userId: null,
      }
      staff.push(created)
      return reply(201, { success: true, data: created })
    }
    const invited = /^\/api\/employees\/(.+)\/invite$/.exec(url.pathname)
    if (method === "POST" && invited) {
      const member = staff.find((s) => s.id === invited[1])!
      member.userId = `u-${member.id}`
      return reply(200, {
        success: true,
        data: member.email
          ? { userId: member.userId, delivery: "email" }
          : {
              userId: member.userId,
              delivery: "slip",
              temporaryPassword: "K7QP-29XM",
            },
      })
    }
    if (method === "DELETE" && url.pathname.startsWith("/api/employees/")) {
      const id = url.pathname.split("/").pop()
      state.staff = staff.filter((s) => s.id !== id)
      return reply(200, { success: true, data: null })
    }
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
    if (method === "PATCH" && url.pathname.startsWith("/api/fee-heads/")) {
      const head = heads.find((h) => h.id === url.pathname.split("/").pop())!
      Object.assign(head, body)
      return reply(200, { success: true, data: head })
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
    const page = (items: unknown[]) =>
      reply(200, {
        success: true,
        data: items,
        meta: { page: 1, limit: 100, total: items.length, totalPages: 1 },
      })
    const academics = state.academics
    if (academics) {
      if (key === "GET /api/academic-years/current") {
        return reply(200, { success: true, data: SESSION })
      }
      if (key === "GET /api/classes") return page(academics.classes)
      if (key === "GET /api/sections") return page(academics.sections)
      if (key === "POST /api/sections") {
        const created = section(
          `s${academics.sections.length + 1}`,
          body.classId,
          body.name
        )
        academics.sections.push(created)
        return reply(201, { success: true, data: created })
      }
      if (key === "PATCH /api/academic-years/y1") {
        return reply(200, { success: true, data: { ...SESSION, ...body } })
      }
      const holidays = (state.holidays ??= [])
      holidays.forEach((h, i) => (h.id ??= `h${i}`))
      if (key === "GET /api/holidays") {
        return page(
          holidays.map((h) => ({
            nameBn: null,
            type: "public",
            dateTo: h.dateFrom,
            ...h,
          }))
        )
      }
      if (key === "POST /api/holidays") {
        const created = { id: `h-new${holidays.length}`, nameBn: null, ...body }
        holidays.push(created)
        return reply(201, { success: true, data: created })
      }
      const holidayId = /^\/api\/holidays\/(.+)$/.exec(url.pathname)?.[1]
      if (holidayId && method === "PATCH") {
        const holiday = holidays.find((h) => h.id === holidayId)!
        Object.assign(holiday, body)
        return reply(200, { success: true, data: holiday })
      }
      if (holidayId && method === "DELETE") {
        state.holidays = holidays.filter((h) => h.id !== holidayId)
        return reply(200, { success: true, data: null })
      }
      if (key === "POST /api/onboarding/templates/holidays/bd/apply") {
        const before = holidays.length
        for (const h of TEMPLATES.holidays.fixed) {
          const dateFrom = `${body.year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`
          if (!holidays.some((x) => x.dateFrom === dateFrom)) {
            holidays.push({ name: h.name, dateFrom })
          }
        }
        return reply(200, {
          success: true,
          data: {
            year: body.year,
            created: holidays.length - before,
            skipped: 0,
            toConfirm: [],
          },
        })
      }
      if (key === "GET /api/class-subjects") {
        return page(academics.classSubjects ?? [])
      }
      const [, kind, id] =
        url.pathname.match(
          /^\/api\/(classes|sections|class-subjects)\/(.+)$/
        ) ?? []
      if (method === "DELETE" && kind === "class-subjects") {
        academics.classSubjects = academics.classSubjects?.filter(
          (s) => s.id !== id
        )
        return reply(200, { success: true, data: null })
      }
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
    if (key === "GET /api/classes") return page([])
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
  // The open step is kept in the address; start each test clean.
  window.history.replaceState(null, "", "/onboarding")
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

    // Not ready: how far, and the next required step past the open one.
    const finish = screen.getByRole("region", { name: "Finish setup" })
    expect(within(finish).getByText("Required steps: 1 of 4 done")).toBeTruthy()
    expect(
      within(finish).queryByRole("button", { name: "Finish setup" })
    ).toBeNull()
    await userEvent.click(
      within(finish).getByRole("button", {
        name: "Next: Classes and subjects",
      })
    )
    expect(
      stepButton(/Classes and subjects/).getAttribute("aria-current")
    ).toBe("step")
  })

  it("reopens the step in the address after a reload, and keeps it there", async () => {
    // Required steps still open, so without the address it'd open session.
    state.checklist = checklist(["profile"])
    window.history.replaceState(null, "", "/onboarding?step=grading")
    renderWizard()
    expect(
      await screen.findByRole("region", { name: "Grading system" })
    ).toBeTruthy()
    expect(stepButton(/Grading system/).getAttribute("aria-current")).toBe(
      "step"
    )

    await userEvent.click(stepButton(/Fee heads/))
    expect(new URLSearchParams(window.location.search).get("step")).toBe("fees")
  })

  it("ignores a step in the address it doesn't know", async () => {
    state.checklist = checklist(["profile"])
    window.history.replaceState(null, "", "/onboarding?step=nonsense")
    renderWizard()
    expect(
      await screen.findByRole("region", { name: "Academic session" })
    ).toBeTruthy()
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

    // The preview follows what is typed.
    expect(
      within(
        within(panel).getByRole("region", {
          name: "Preview of the school's heading",
        })
      ).getByText("Dhaka")
    ).toBeTruthy()

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === "PATCH")?.body).toEqual({
        nameBn: null,
        address: { line1: null, area: null, district: "Dhaka", postCode: null },
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
    const madrasa = await within(panel).findByRole("radio", { name: "Madrasa" })
    expect(madrasa).toBeChecked()

    await userEvent.click(within(panel).getByRole("radio", { name: "College" }))
    expect(within(panel).getByRole("radio", { name: "College" })).toBeChecked()
    await userEvent.type(within(panel).getByLabelText("District"), "Dhaka")
    await userEvent.type(within(panel).getByLabelText("Phone"), "01712345678")
    const eiin = within(panel).getByLabelText("EIIN")
    await userEvent.type(eiin, "12")
    const save = within(panel).getByRole("button", {
      name: "Save and continue",
    })
    await userEvent.click(save)
    expect(within(panel).getByText("An EIIN is 4 to 10 digits")).toBeTruthy()
    await userEvent.type(eiin, "8256")
    await userEvent.click(save)

    await waitFor(() =>
      expect(
        api.calls
          .filter((c) => c.method === "PATCH")
          .map((c) => [c.path, c.body])
      ).toEqual([
        ["/api/settings/organization", { type: "college", eiin: "128256" }],
        [
          "/api/settings/profile",
          {
            nameBn: null,
            address: {
              line1: null,
              area: null,
              district: "Dhaka",
              postCode: null,
            },
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

  it("fills the dates from a usual school year", async () => {
    state.checklist = checklist(["profile"])
    renderWizard()
    const panel = await screen.findByRole("region", {
      name: "Academic session",
    })
    const calendar = await within(panel).findByRole("button", {
      name: /January – December/,
    })
    expect(calendar.getAttribute("aria-pressed")).toBe("true")
    // The dates are set by the choice: no date fields until custom.
    expect(within(panel).queryByLabelText("Starts on")).toBeNull()

    await userEvent.click(
      within(panel).getByRole("button", { name: /July – June/ })
    )
    const today = new Date()
    const july =
      today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1
    expect(within(panel).getByLabelText("Name")).toHaveValue(
      `${july}–${july + 1}`
    )
    expect(within(panel).getByText(/12 months/)).toBeTruthy()
    await userEvent.click(
      within(panel).getByRole("button", { name: "Create session" })
    )
    await waitFor(() =>
      expect(
        api.calls.find((c) => c.path === "/api/academic-years")?.body
      ).toEqual({
        name: `${july}–${july + 1}`,
        startDate: `${july}-07-01`,
        endDate: `${july + 1}-06-30`,
        isCurrent: true,
      })
    )
  })

  it("takes the school's own dates with custom", async () => {
    state.checklist = checklist(["profile"])
    renderWizard()
    const panel = await screen.findByRole("region", {
      name: "Academic session",
    })
    const custom = await within(panel).findByRole("button", {
      name: /Custom dates/,
    })
    await userEvent.click(custom)
    expect(custom.getAttribute("aria-pressed")).toBe("true")
    expect(
      within(panel)
        .getByRole("button", { name: /January – December/ })
        .getAttribute("aria-pressed")
    ).toBe("false")

    const name = within(panel).getByLabelText("Name")
    await userEvent.clear(name)
    await userEvent.type(name, "2026–2027")
    // Date inputs take a typed `YYYY-MM-DD` in jsdom.
    const start = within(panel).getByLabelText("Starts on")
    const end = within(panel).getByLabelText("Ends on")
    await userEvent.clear(start)
    await userEvent.type(start, "2026-04-01")
    await userEvent.clear(end)
    await userEvent.type(end, "2027-03-31")
    expect(within(panel).getByText(/12 months/)).toBeTruthy()

    await userEvent.click(
      within(panel).getByRole("button", { name: "Create session" })
    )
    await waitFor(() =>
      expect(
        api.calls.find((c) => c.path === "/api/academic-years")?.body
      ).toEqual({
        name: "2026–2027",
        startDate: "2026-04-01",
        endDate: "2027-03-31",
        isCurrent: true,
      })
    )
  })

  it("shows the current session, edits it, and adds its government holidays", async () => {
    state.checklist = checklist(["profile", "session"])
    state.academics = { classes: [], sections: [] }
    state.holidays = [{ name: "Language Martyrs' Day", dateFrom: "2026-02-21" }]
    renderWizard()
    await userEvent.click(
      await screen.findByRole("button", { name: /Academic session/ })
    )
    const panel = await screen.findByRole("region", {
      name: "Academic session",
    })
    expect(await within(panel).findByText(/12 months/)).toBeTruthy()

    // One of the two is there already.
    await userEvent.click(
      await within(panel).findByRole("button", { name: "Add 1 holiday" })
    )
    expect(await within(panel).findByText("All added")).toBeTruthy()
    expect(within(panel).getByText(/Eid ul-Fitr/)).toBeTruthy()

    await userEvent.click(within(panel).getByRole("button", { name: "Edit" }))
    const name = within(panel).getByLabelText("Name")
    await userEvent.clear(name)
    await userEvent.type(name, "Session 2026")
    await userEvent.click(
      within(panel).getByRole("button", { name: "Save changes" })
    )
    await waitFor(() =>
      expect(api.calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
        name: "Session 2026",
      })
    )
  })

  it("lists the session's holidays to edit, remove, or add one", async () => {
    state.checklist = checklist(["profile", "session"])
    state.academics = { classes: [], sections: [] }
    state.holidays = [
      { name: "Language Martyrs' Day", dateFrom: "2026-02-21" },
      { name: "Independence Day", dateFrom: "2026-03-26" },
    ]
    renderWizard()
    await userEvent.click(
      await screen.findByRole("button", { name: /Academic session/ })
    )
    const panel = await screen.findByRole("region", {
      name: "Academic session",
    })
    const list = await within(panel).findByRole("list", {
      name: "Holidays in 2026",
    })
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)

    // Remove one: it goes, and the government card offers it again.
    await userEvent.click(
      within(list).getByRole("button", { name: "Remove Independence Day" })
    )
    await waitFor(() =>
      expect(within(list).queryByText("Independence Day")).toBeNull()
    )
    expect(
      within(panel).getByRole("button", { name: "Add 1 holiday" })
    ).toBeTruthy()

    // Edit the other in place.
    await userEvent.click(
      within(list).getByRole("button", {
        name: "Edit Language Martyrs' Day",
      })
    )
    const name = within(list).getByLabelText("Name")
    await userEvent.clear(name)
    await userEvent.type(name, "Shaheed Dibosh")
    await userEvent.click(
      within(list).getByRole("button", { name: "Save changes" })
    )
    await waitFor(() =>
      expect(
        api.calls.find(
          (c) => c.method === "PATCH" && c.path.startsWith("/api/holidays/")
        )?.body
      ).toEqual({
        name: "Shaheed Dibosh",
        type: "public",
        dateFrom: "2026-02-21",
        dateTo: "2026-02-21",
      })
    )

    // Add a moon-dated one once its date is known: three days.
    await userEvent.click(
      within(panel).getByRole("button", { name: "Add a holiday" })
    )
    await userEvent.type(within(panel).getByLabelText("Name"), "Eid ul-Fitr")
    const from = within(panel).getByLabelText("From")
    await userEvent.clear(from)
    await userEvent.type(from, "2026-03-20")
    await userEvent.type(
      within(panel).getByLabelText("To (if more than one day)"),
      "2026-03-22"
    )
    await userEvent.click(within(panel).getByRole("button", { name: "Add" }))
    await waitFor(() =>
      expect(
        api.calls.find((c) => c.method === "POST" && c.path === "/api/holidays")
          ?.body
      ).toEqual({
        name: "Eid ul-Fitr",
        type: "religious",
        dateFrom: "2026-03-20",
        dateTo: "2026-03-22",
      })
    )
    expect(await within(list).findByText("Eid ul-Fitr")).toBeTruthy()
  })

  it("adds staff and invites them: a slip for phone-only, an email otherwise", async () => {
    state.checklist = checklist(REQUIRED)
    state.staff = [
      {
        id: "e0",
        employeeNumber: "EMP-000",
        firstName: "Nasima",
        lastName: "Akter",
        fullName: "Nasima Akter",
        email: "nasima@school.test",
        phone: null,
        userId: null,
      },
    ]
    renderWizard()
    await userEvent.click(
      await screen.findByRole("button", { name: /Add and invite staff/ })
    )
    const panel = await screen.findByRole("region", {
      name: "Add and invite staff",
    })
    const list = await within(panel).findByRole("list", { name: "Your staff" })

    // Portal roles aren't offered; teacher is the default.
    const rowRole = within(list).getByLabelText("Role for Nasima Akter")
    expect(rowRole).toHaveValue("r-teach")
    expect(
      within(rowRole).queryByRole("option", { name: /guardian/i })
    ).toBeNull()

    // Someone added earlier, invited from their row as accountant.
    await userEvent.selectOptions(rowRole, "r-acc")
    await userEvent.click(
      within(list).getByRole("button", { name: "Invite Nasima Akter" })
    )
    await waitFor(() =>
      expect(
        api.calls.find((c) => c.path === "/api/employees/e0/invite")?.body
      ).toEqual({ roleIds: ["r-acc"] })
    )
    expect(await within(list).findByText("Has a login")).toBeTruthy()

    // A phone-only teacher: added, invited, and a slip to hand over.
    await userEvent.type(within(panel).getByLabelText("First name"), "Rafiq")
    await userEvent.type(within(panel).getByLabelText("Last name"), "Ahmed")
    await userEvent.type(within(panel).getByLabelText("Phone"), "01712345678")
    await userEvent.click(
      within(panel).getByRole("button", { name: "Add and invite" })
    )
    const slip = await within(panel).findByRole("region", {
      name: "Sign-in slip for Rafiq Ahmed",
    })
    expect(within(slip).getByText("K7QP-29XM")).toBeTruthy()
    expect(
      api.calls.find((c) => c.method === "POST" && c.path === "/api/employees")
        ?.body
    ).toEqual({ firstName: "Rafiq", lastName: "Ahmed", phone: "01712345678" })
    await userEvent.click(within(slip).getByRole("button", { name: "Done" }))
    expect(
      within(panel).queryByRole("region", { name: /Sign-in slip/ })
    ).toBeNull()

    // Removed.
    await userEvent.click(
      within(list).getByRole("button", { name: "Remove Rafiq Ahmed" })
    )
    await waitFor(() =>
      expect(within(list).queryByText("Rafiq Ahmed")).toBeNull()
    )
  })

  it("asks for a way to reach someone before inviting them", async () => {
    state.checklist = checklist(REQUIRED)
    renderWizard()
    await userEvent.click(
      await screen.findByRole("button", { name: /Add and invite staff/ })
    )
    const panel = await screen.findByRole("region", {
      name: "Add and invite staff",
    })
    await userEvent.type(
      await within(panel).findByLabelText("First name"),
      "Rafiq"
    )
    await userEvent.type(within(panel).getByLabelText("Last name"), "Ahmed")
    await userEvent.click(
      within(panel).getByRole("button", { name: "Add and invite" })
    )
    expect(
      within(panel).getByText("Enter a phone number or an email to invite them")
    ).toBeTruthy()

    // Without the invite, a record alone is fine.
    await userEvent.click(
      within(panel).getByRole("checkbox", {
        name: /Invite them to sign in now/,
      })
    )
    await userEvent.click(within(panel).getByRole("button", { name: "Add" }))
    await waitFor(() =>
      expect(api.calls.filter((c) => c.path.endsWith("/invite"))).toHaveLength(
        0
      )
    )
    expect(
      await within(panel).findByRole("list", { name: "Your staff" })
    ).toBeTruthy()
  })

  it("gives every class without a section its section A in one go", async () => {
    state.checklist = checklist(["profile", "session", "curriculum"])
    state.academics = {
      classes: [
        schoolClass("c6", "Class 6"),
        schoolClass("c7", "Class 7"),
        schoolClass("c8", "Class 8"),
      ],
      sections: [section("s1", "c6", "A")],
    }
    renderWizard()
    const panel = await screen.findByRole("region", { name: "Sections" })
    expect(
      await within(panel).findByText("1 of 3 classes have a section.")
    ).toBeTruthy()

    await userEvent.click(
      within(panel).getByRole("button", {
        name: "Add section A to the 2 classes without one",
      })
    )
    expect(
      await within(panel).findByText("Every class has a section")
    ).toBeTruthy()
    expect(
      api.calls
        .filter((c) => c.method === "POST" && c.path === "/api/sections")
        .map((c) => (c.body as { classId: string }).classId)
    ).toEqual(["c7", "c8"])
  })

  it("adds the next section in one click, or one by another name", async () => {
    state.checklist = checklist(["profile", "session", "curriculum"])
    state.academics = {
      classes: [schoolClass("c6", "Class 6")],
      sections: [section("s1", "c6", "A"), section("s2", "c6", "B")],
    }
    renderWizard()
    const panel = await screen.findByRole("region", { name: "Sections" })
    const sectionPosts = () =>
      api.calls
        .filter((c) => c.method === "POST" && c.path === "/api/sections")
        .map((c) => (c.body as { name: string }).name)

    await userEvent.click(
      await within(panel).findByRole("button", {
        name: "Add section C to Class 6",
      })
    )
    await waitFor(() => expect(sectionPosts()).toEqual(["C"]))
    // The next letter moves on.
    expect(
      await within(panel).findByRole("button", {
        name: "Add section D to Class 6",
      })
    ).toBeTruthy()

    await userEvent.click(
      within(panel).getByRole("button", { name: "Other name" })
    )
    await userEvent.type(
      within(panel).getByLabelText("New section for Class 6"),
      "Rose"
    )
    await userEvent.click(
      within(panel).getByRole("button", { name: "Add to Class 6" })
    )
    await waitFor(() => expect(sectionPosts()).toEqual(["C", "Rose"]))
  })

  it("removes a section, and a class after confirming", async () => {
    state.checklist = checklist(["profile", "session", "curriculum"])
    state.academics = {
      classes: [schoolClass("c6", "Class 6"), schoolClass("c7", "Class 7")],
      sections: [section("s1", "c6", "A"), section("s2", "c6", "B")],
    }
    renderWizard()
    const panel = await screen.findByRole("region", {
      name: "Sections",
    })

    const tiles = await within(panel).findByRole("list", {
      name: "Sections of Class 6",
    })
    expect(within(tiles).getAllByRole("listitem")).toHaveLength(2)
    await userEvent.click(
      within(tiles).getByRole("button", {
        name: "Remove section B of Class 6",
      })
    )
    await waitFor(() =>
      expect(
        within(
          within(panel).getByRole("list", { name: "Sections of Class 6" })
        ).getAllByRole("listitem")
      ).toHaveLength(1)
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
    const list = await within(panel).findByRole("table", {
      name: "Your fee heads",
    })
    expect(within(list).getByText("Tuition Fee")).toBeTruthy()
    expect(
      within(list).getByLabelText("How often Tuition Fee is billed")
    ).toHaveValue("monthly")
    expect(within(panel).getByText("All added")).toBeTruthy()

    // How often, changed in place.
    await userEvent.selectOptions(
      within(list).getByLabelText("How often Tuition Fee is billed"),
      "quarterly"
    )
    await waitFor(() =>
      expect(
        api.calls.find(
          (c) => c.method === "PATCH" && c.path.startsWith("/api/fee-heads/")
        )?.body
      ).toEqual({ frequency: "quarterly" })
    )

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

  it("suggests the school type's curriculum first, applies it, then goes on to sections", async () => {
    state.checklist = checklist(["profile", "session"])
    renderWizard()
    // The template step comes before sections: it adds the classes.
    const panel = await screen.findByRole("region", {
      name: "Classes and subjects",
    })
    const list = await within(panel).findByRole("list", {
      name: "Curriculum templates",
    })
    const items = within(list).getAllByRole("listitem")
    expect(items[0]!.textContent).toContain("Alia madrasa")
    expect(within(items[0]!).getByText("Suggested")).toBeTruthy()

    state.checklist = checklist(["profile", "session", "curriculum"])
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

    await userEvent.click(
      await within(panel).findByRole("button", { name: "Continue" })
    )
    expect(stepButton(/Sections/).getAttribute("aria-current")).toBe("step")
  })

  it("shows each class's subjects, removes one, and switches to another template", async () => {
    state.checklist = checklist(["profile", "session", "classes"])
    state.curriculumInUse = "nctb"
    const classSubject = (
      id: string,
      classId: string,
      name: string,
      subjectType: ClassSubject["subjectType"] = "compulsory"
    ): ClassSubject => ({
      id,
      classId,
      subjectId: `sub-${id}`,
      academicYearId: "y1",
      subjectType,
      subject: { id: `sub-${id}`, name, code: null },
      subjectGroup: null,
    })
    state.academics = {
      classes: [schoolClass("c1", "Class 1"), schoolClass("c6", "Class 6")],
      sections: [section("s1", "c1", "A")],
      classSubjects: [
        classSubject("cs1", "c1", "Bangla"),
        classSubject("cs2", "c1", "Islam", "optional"),
      ],
    }
    renderWizard()
    const panel = await screen.findByRole("region", {
      name: "Classes and subjects",
    })
    const classes = await within(panel).findByRole("list", {
      name: "Classes and their subjects in 2026",
    })
    expect(within(panel).getByText(/1 of 2 classes have subjects/)).toBeTruthy()
    expect(within(classes).getByText("No subjects yet")).toBeTruthy()

    await userEvent.click(
      within(classes).getByRole("button", { name: /Class 1/ })
    )
    const subjects = within(classes).getByRole("list", {
      name: "Subjects of Class 1",
    })
    expect(within(subjects).getByText(/optional/)).toBeTruthy()
    await userEvent.click(
      within(subjects).getByRole("button", {
        name: "Remove Bangla from Class 1",
      })
    )
    await waitFor(() =>
      expect(within(classes).queryByText("Bangla")).toBeNull()
    )
    expect(
      api.calls.some(
        (c) => c.method === "DELETE" && c.path === "/api/class-subjects/cs1"
      )
    ).toBe(true)

    // The order doesn't change for the template in use (the suggested one
    // stays first); choosing another switches after a confirmation.
    const templates = await within(panel).findByRole("list", {
      name: "Curriculum templates",
    })
    const [alia, nctb] = Array.from(templates.children) as HTMLElement[]
    expect(templates.children).toHaveLength(2)
    expect(nctb!.textContent).toContain("NCTB")
    expect(within(nctb!).getByText("In use")).toBeTruthy()
    expect(
      within(nctb!).getByRole("button", { name: /Add anything missing/ })
    ).toBeTruthy()
    expect(alia!.textContent).toContain("Alia madrasa")
    expect(within(panel).getByText(/Your school uses NCTB/)).toBeTruthy()

    await userEvent.click(
      within(alia!).getByRole("button", { name: /Switch to this template/ })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Everything NCTB .* added is removed/))
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Switch template" })
    )
    await waitFor(() =>
      expect(
        api.calls.some(
          (c) =>
            c.method === "POST" &&
            c.path ===
              "/api/onboarding/templates/curriculum/alia-madrasa/switch"
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
    expect(within(grading).getByText(/Step 5 of 7/)).toBeTruthy()

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

  it("skips the last step on to the finish page, not back to a skipped one", async () => {
    // Required done, grading skipped earlier, fees done; staff is last.
    state.checklist = checklist([...REQUIRED, "fees"])
    state.feeHeads = [
      {
        id: "h1",
        name: "Tuition Fee",
        nameBn: null,
        frequency: "monthly",
        isActive: true,
        sortOrder: 0,
      },
      {
        id: "h2",
        name: "Exam Fee",
        nameBn: null,
        frequency: "yearly",
        isActive: true,
        sortOrder: 1,
      },
    ]
    renderWizard()
    await userEvent.click(
      await screen.findByRole("button", { name: /Add and invite staff/ })
    )
    const staff = await screen.findByRole("region", {
      name: "Add and invite staff",
    })
    expect(within(staff).getByText(/Step 7 of 7/)).toBeTruthy()

    await userEvent.click(
      within(staff).getByRole("button", { name: "Skip to finish" })
    )
    // The finish page, not grading again; the side card steps aside.
    const page = await screen.findByRole("region", {
      name: "Review and finish",
    })
    expect(stepButton(/Last step/).getAttribute("aria-current")).toBe("step")
    expect(screen.queryByRole("region", { name: "Finish setup" })).toBeNull()
    const summary = within(page).getByRole("list", { name: "Optional steps" })
    expect(
      within(page).getByRole("list", { name: "Required steps" })
    ).toBeTruthy()
    // A done step says what it set up.
    expect(
      await within(summary).findByText(
        "2 fee heads · 1 monthly · Tuition Fee, Exam Fee"
      )
    ).toBeTruthy()
    // Grading (skipped earlier) and staff (just now).
    expect(
      within(summary).getAllByText("Skipped: you can do it later")
    ).toHaveLength(2)

    // A way back to the skipped step.
    await userEvent.click(
      within(summary).getByRole("button", { name: "Open Grading system" })
    )
    expect(stepButton(/Grading system/).getAttribute("aria-current")).toBe(
      "step"
    )
  })

  it("finishes on the last page once every required step is done", async () => {
    state.checklist = checklist(REQUIRED)
    renderWizard()
    // The side card leads there; it submits nothing itself.
    const card = await screen.findByRole("region", { name: "Finish setup" })
    expect(within(card).getByText("Ready to open your school")).toBeTruthy()
    expect(
      within(card).queryByRole("button", { name: "Finish setup" })
    ).toBeNull()
    await userEvent.click(
      within(card).getByRole("button", { name: "Review and finish" })
    )

    const page = await screen.findByRole("region", {
      name: "Review and finish",
    })
    // Finishing does what skipping would, so only Finish is offered.
    expect(
      within(page).queryByRole("button", { name: "Skip for now" })
    ).toBeNull()
    await userEvent.click(
      within(page).getByRole("button", { name: "Finish setup" })
    )
    await waitFor(() => expect(actions.completeOnboarding).toHaveBeenCalled())
  })

  it("can be skipped from the last page while required steps are open", async () => {
    state.checklist = checklist(["profile"])
    renderWizard()
    await userEvent.click(
      await screen.findByRole("button", { name: /Last step/ })
    )
    const page = await screen.findByRole("region", {
      name: "Review and finish",
    })
    expect(
      within(page).queryByRole("button", { name: "Finish setup" })
    ).toBeNull()
    await userEvent.click(
      within(page).getByRole("button", { name: "Skip for now" })
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
