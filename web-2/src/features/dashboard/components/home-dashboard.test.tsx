import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import bn from "../../../../messages/bn.json"
import en from "../../../../messages/en.json"
import { authKeys, type Me } from "~/features/auth/api"
import type {
  AccountantDashboard,
  AdminDashboard,
  TeacherDashboard,
} from "~/features/dashboard/api"
import { settingsKeys, type DisplaySettings } from "~/features/settings/api"
import { toPermissions } from "~/features/access/permissions"

import { HomeDashboard, homeGroups } from "./home-dashboard"

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

const collection = (total: number, payments: number) => ({
  from: "2026-10-25",
  to: "2026-10-25",
  payments,
  total,
  byChannel: { cash: total },
})

const dues = {
  students: 3,
  outstanding: 1_250_000,
  buckets: {
    current: 250_000,
    "0-30": 1_000_000,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  },
}

const ADMIN: AdminDashboard = {
  date: "2026-10-25",
  enrollment: {
    total: 120,
    byClass: [
      { classId: "c6", className: "Class 6", students: 70 },
      { classId: "c7", className: "Class 7", students: 50 },
    ],
  },
  attendanceToday: {
    days: 100,
    present: 90,
    absent: 8,
    late: 2,
    leave: 0,
    halfDay: 0,
    percentage: 92,
    enrolled: 120,
    sections: 4,
    submitted: 3,
    byClass: [
      {
        classId: "c6",
        className: "Class 6",
        percentage: 92,
        submitted: 2,
        sections: 2,
      },
      {
        classId: "c7",
        className: "Class 7",
        percentage: null,
        submitted: 0,
        sections: 2,
      },
    ],
  },
  collection: {
    today: collection(500_000, 2),
    monthToDate: collection(12_345_600, 40),
  },
  dues,
  staff: { active: 18 },
  upcoming: [
    {
      kind: "exam",
      title: "Half-yearly",
      date: "2026-11-02",
      endDate: "2026-11-10",
    },
  ],
}

const TEACHER: TeacherDashboard = {
  date: "2026-10-25",
  sections: [
    {
      sectionId: "s1",
      sectionName: "A",
      classId: "c6",
      className: "Class 6",
      status: "pending",
      holiday: null,
      registers: 0,
      submittedAt: null,
      takenBy: null,
    },
    {
      sectionId: "s2",
      sectionName: "B",
      classId: "c6",
      className: "Class 6",
      status: "submitted",
      holiday: null,
      registers: 1,
      submittedAt: "2026-10-25T03:00:00.000Z",
      takenBy: "u1",
    },
  ],
  pendingAttendance: 1,
  pendingMarkSheets: [
    {
      id: "m1",
      examId: "e1",
      subjectName: "Mathematics",
      sectionId: "s1",
      sectionName: "A",
    },
  ],
}

const ACCOUNTANT: AccountantDashboard = {
  date: "2026-10-25",
  collection: {
    today: collection(500_000, 2),
    monthToDate: collection(12_345_600, 40),
  },
  dues,
  expenses: { monthToDate: 75_000 },
  recentPayments: [
    {
      id: "p1",
      amount: 250_000,
      channel: "cash",
      status: "completed",
      receivedAt: "2026-10-25T04:30:00.000Z",
      payer: "Rafi Ahmed",
    },
  ],
}

const me = (permissions: string[], isAdmin = false): Me => ({
  id: "u1",
  name: "Nusrat Jahan",
  email: "nusrat@acme.test",
  phone: null,
  status: "active",
  isAdmin,
  membershipId: "m1",
  roles: [],
  permissions,
  identities: [],
  organization: {
    id: "o1",
    slug: "acme",
    name: "Acme School",
    status: "active",
    onboardingCompletedAt: "2026-10-01T00:00:00.000Z",
  },
  plan: {
    code: "standard",
    effectiveCode: "standard",
    onTrial: false,
    trialEndsAt: null,
    modules: [],
    limits: {},
  },
})

/** Answers by path; `failing` paths get the backend's 500 envelope. */
function backend(failing: string[] = []) {
  const answers: Record<string, unknown> = {
    "/api/dashboards/admin": ADMIN,
    "/api/dashboards/teacher": TEACHER,
    "/api/dashboards/accountant": ACCOUNTANT,
    "/api/onboarding/checklist": {
      steps: [],
      percentage: 60,
      canComplete: false,
    },
  }
  return vi.fn((input: RequestInfo | URL) => {
    const path = new URL(String(input), "http://x.test").pathname
    const ok = !failing.includes(path) && path in answers
    const body = ok
      ? { success: true, data: answers[path] }
      : { success: false, statusCode: 500, message: "Boom", code: "INTERNAL" }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: ok ? 200 : 500,
        headers: { "content-type": "application/json" },
      })
    )
  })
}

function renderHome(member: Me, locale: "en" | "bn" = "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(authKeys.me, member)
  client.setQueryData(settingsKeys.display, DISPLAY)
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "bn" ? bn : en}
        timeZone="Asia/Dhaka"
      >
        <HomeDashboard />
      </NextIntlClientProvider>
    </QueryClientProvider>
  )
}

const section = (name: string) =>
  screen.getByRole("region", { name }) as HTMLElement

let fetchMock: ReturnType<typeof backend>

beforeEach(() => {
  fetchMock = backend()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("homeGroups", () => {
  it("follows the dashboard keys, not role names", () => {
    const member = (keys: string[], isAdmin = false) =>
      homeGroups(toPermissions({ isAdmin, permissions: keys }))
    expect(member(["dashboard_teacher:read"])).toEqual({
      onboarding: false,
      overview: false,
      myDay: true,
      finance: false,
    })
    expect(
      member(["dashboard_admin:read", "dashboard_accountant:read"])
    ).toMatchObject({ overview: true, finance: true, myDay: false })
    expect(member([], true)).toEqual({
      onboarding: true,
      overview: true,
      myDay: true,
      finance: true,
    })
  })
})

describe("HomeDashboard", () => {
  it("shows a principal who is also an accountant both groups", async () => {
    renderHome(me(["dashboard_admin:read", "dashboard_accountant:read"]))

    const overview = section("School overview")
    expect(await within(overview).findByText("৳1,23,456")).toBeTruthy()
    // The tile and the Class 6 bar.
    expect(within(overview).getAllByText("92%")).toHaveLength(2)
    expect(within(overview).getByText("3 of 4 registers in")).toBeTruthy()
    expect(within(overview).getByText("Not taken")).toBeTruthy()
    expect(within(overview).getByText("Half-yearly")).toBeTruthy()

    const finance = section("Finance")
    expect(await within(finance).findByText("Rafi Ahmed")).toBeTruthy()
    expect(within(finance).getByText("৳2,500.00")).toBeTruthy()
    expect(within(finance).getByText("৳750")).toBeTruthy()

    expect(screen.queryByRole("region", { name: "My day" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/dashboards/teacher",
      expect.anything()
    )
  })

  it("keeps the other groups when one endpoint fails, and retries it", async () => {
    fetchMock = backend(["/api/dashboards/admin"])
    vi.stubGlobal("fetch", fetchMock)
    renderHome(me([], true))

    const overview = section("School overview")
    expect(
      await within(overview).findByText(
        "This part of the dashboard couldn't load."
      )
    ).toBeTruthy()
    expect(
      await within(section("My day")).findByText("Mathematics")
    ).toBeTruthy()
    expect(
      await within(section("Finance")).findByText("Rafi Ahmed")
    ).toBeTruthy()

    fetchMock = backend()
    vi.stubGlobal("fetch", fetchMock)
    await userEvent.click(
      within(overview).getByRole("button", { name: "Try again" })
    )
    expect(await within(overview).findByText("৳1,23,456")).toBeTruthy()
  })

  it("links a teacher to the registers and mark sheets still to do", async () => {
    renderHome(me(["dashboard_teacher:read"]))
    const day = section("My day")
    const take = await within(day).findByRole("link", {
      name: "Take attendance",
    })
    expect(take.getAttribute("href")).toBe(
      "/dashboard/attendance/take?section=s1"
    )
    expect(
      within(day)
        .getByRole("link", { name: "Enter marks" })
        .getAttribute("href")
    ).toBe("/dashboard/exams/marks?sheet=m1")
    // Only the pending section offers the action.
    expect(
      within(day).getAllByRole("link", { name: "Take attendance" })
    ).toHaveLength(1)
  })

  it("nudges admins to finish setup while the checklist is incomplete", async () => {
    renderHome(me([], true))
    const banner = await screen.findByRole("region", {
      name: "Finish setting up your school",
    })
    expect(within(banner).getByText(/60% done/)).toBeTruthy()
    expect(
      within(banner)
        .getByRole("link", { name: "Continue setup" })
        .getAttribute("href")
    ).toBe("/onboarding")
  })

  it("gives members without dashboard keys their menus instead", async () => {
    renderHome(me(["students:read"]))
    expect(await screen.findByText("Students")).toBeTruthy()
    expect(screen.queryByRole("region", { name: "School overview" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses Bangla digits for a Bangla reader", async () => {
    renderHome(me(["dashboard_accountant:read"]), "bn")
    const finance = section("হিসাব")
    expect(await within(finance).findByText("৳২,৫০০.০০")).toBeTruthy()
    expect(within(finance).getByText("৳৭৫০")).toBeTruthy()
  })
})
