import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import bn from "../../../../messages/bn.json"
import en from "../../../../messages/en.json"
import {
  portalKeys,
  selectedChild,
  type ChildDashboard,
  type PortalChild,
  type PortalSchool,
} from "~/features/portal/api"
import { settingsKeys, type DisplaySettings } from "~/features/settings/api"
import { testSession } from "~/test/sessions"

import { ChildHome } from "./child-home"
import { activePortalItem, withChild } from "../portal-nav"
import { PortalShell } from "./portal-shell"

const nav = vi.hoisted(() => ({
  search: new URLSearchParams(),
  pathname: "/student",
  replace: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.search,
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}))

const DISPLAY: DisplaySettings = {
  name: "Acme School",
  nameBn: "একমি স্কুল",
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

const child = (id: string, name: string, className: string): PortalChild => ({
  studentId: id,
  name,
  nameBn: null,
  admissionNumber: `ACM-${id}`,
  relation: "guardian",
  enrollment: {
    id: `e-${id}`,
    academicYearId: "y1",
    classId: "c1",
    className,
    sectionId: "sec1",
    sectionName: "A",
    rollNo: "7",
  },
})

const RAFI = child("s1", "Rafi Ahmed", "Class 6")
const NUSRAT = child("s2", "Nusrat Ahmed", "Class 3")

const dashboard = (c: PortalChild): ChildDashboard => ({
  child: c,
  attendance: {
    today:
      c === RAFI
        ? {
            date: "2026-10-25",
            status: "P",
            label: "Present",
            labelBn: "উপস্থিত",
            countsAs: "present",
          }
        : null,
    session: {
      from: "2026-01-01",
      to: "2026-10-25",
      days: 120,
      present: 100,
      absent: 10,
      late: 8,
      leave: 2,
      halfDay: 0,
      percentage: 91.7,
    },
  },
  upcomingExams:
    c === RAFI
      ? [
          {
            id: "x1",
            name: "Half-yearly",
            startDate: "2026-11-02",
            endDate: "2026-11-10",
          },
        ]
      : [],
  dues: {
    outstanding: c === RAFI ? 150_000 : 0,
    nextDueDate: c === RAFI ? "2026-11-10" : null,
    nextDueAmount: c === RAFI ? 150_000 : 0,
  },
  notices: [
    {
      id: "n1",
      title: "Sports day",
      body: "Sports day is on Thursday.",
      publishAt: "2026-10-20T04:00:00.000Z",
      pinned: true,
      read: false,
    },
  ],
})

const OTHER: PortalSchool[] = [
  {
    orgId: "org-2",
    slug: "beta",
    name: "Beta High School",
    host: "beta.lvh.me",
    children: [{ studentId: "b1", name: "Tania Ahmed", className: "Class 9" }],
  },
]

function backend() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://x.test").pathname
    const answers: Record<string, unknown> = {
      "/api/portal/children/s1/dashboard": dashboard(RAFI),
      "/api/portal/children/s2/dashboard": dashboard(NUSRAT),
      "/api/portal/schools": OTHER,
      "/api/portal/handoff": {
        redirectUrl: "http://beta.lvh.me:3000/auth/handoff?code=c",
      },
    }
    const ok = path in answers
    void init
    return Promise.resolve(
      new Response(
        JSON.stringify(
          ok
            ? { success: true, data: answers[path] }
            : { success: false, statusCode: 404, code: "NOT_FOUND" }
        ),
        {
          status: ok ? 200 : 404,
          headers: { "content-type": "application/json" },
        }
      )
    )
  })
}

function renderPortal(children: PortalChild[], locale: "en" | "bn" = "en") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const session = testSession({
    user: { ...testSession().user, roles: ["guardian"], name: "Karim Ahmed" },
  })
  client.setQueryData(settingsKeys.display, DISPLAY)
  client.setQueryData(portalKeys.children, children)
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "bn" ? bn : en}
        timeZone="Asia/Dhaka"
      >
        <PortalShell schoolName="Acme School" user={session.user}>
          <ChildHome />
        </PortalShell>
      </NextIntlClientProvider>
    </QueryClientProvider>
  )
}

let fetchMock: ReturnType<typeof backend>

beforeEach(() => {
  nav.search = new URLSearchParams()
  nav.pathname = "/student"
  fetchMock = backend()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("portal helpers", () => {
  it("selectedChild follows ?child= only for the user's own children", () => {
    expect(selectedChild([RAFI, NUSRAT], "s2")).toBe(NUSRAT)
    expect(selectedChild([RAFI, NUSRAT], "someone-else")).toBe(RAFI)
    expect(selectedChild([RAFI, NUSRAT], null)).toBe(RAFI)
    expect(selectedChild([], "s1")).toBeNull()
  })

  it("activePortalItem marks Home only on /student itself", () => {
    expect(activePortalItem("/student")?.id).toBe("home")
    expect(activePortalItem("/student/fees")?.id).toBe("fees")
    expect(activePortalItem("/student/fees/2026")?.id).toBe("fees")
    expect(activePortalItem("/dashboard")).toBeNull()
  })

  it("withChild keeps the selection on links", () => {
    expect(withChild("/student/fees", "s 1")).toBe("/student/fees?child=s%201")
    expect(withChild("/student", null)).toBe("/student")
  })
})

describe("PortalShell and ChildHome", () => {
  it("shows the first child's day and lets a guardian pick another", async () => {
    renderPortal([RAFI, NUSRAT])

    expect(
      await screen.findByRole("heading", { level: 1, name: "Rafi Ahmed" })
    ).toBeTruthy()
    expect(screen.getByText("Present")).toBeTruthy()
    expect(screen.getByText("91.7%")).toBeTruthy()
    expect(screen.getByText("Present 108 of 120 days")).toBeTruthy()
    expect(screen.getByText("৳1,500")).toBeTruthy()
    expect(screen.getByText("Half-yearly")).toBeTruthy()
    expect(screen.getByText("Sports day")).toBeTruthy()

    const picker = screen.getByLabelText("Choose a child") as HTMLSelectElement
    expect(picker.value).toBe("s1")
    expect([...picker.options].map((o) => o.textContent)).toEqual([
      "Rafi Ahmed · Class 6, section A",
      "Nusrat Ahmed · Class 3, section A",
    ])
    await userEvent.selectOptions(picker, "s2")
    expect(nav.replace).toHaveBeenCalledWith("/student?child=s2", {
      scroll: false,
    })
  })

  it("follows ?child= and keeps it on the section links", async () => {
    nav.search = new URLSearchParams("child=s2")
    renderPortal([RAFI, NUSRAT])

    expect(
      await screen.findByRole("heading", { level: 1, name: "Nusrat Ahmed" })
    ).toBeTruthy()
    expect(screen.getByText("Not taken yet")).toBeTruthy()
    expect(screen.getByText("Nothing due")).toBeTruthy()
    expect(screen.getByText("No exams coming up.")).toBeTruthy()

    const sections = screen.getAllByRole("navigation", { name: "Sections" })
    const fees = within(sections[0]!).getByRole("link", { name: "Fees" })
    expect(fees.getAttribute("href")).toBe("/student/fees?child=s2")
    const home = within(sections[0]!).getByRole("link", { name: "Home" })
    expect(home.getAttribute("aria-current")).toBe("page")
  })

  it("names a single child instead of offering a picker", async () => {
    renderPortal([RAFI])
    await screen.findByRole("heading", { level: 1, name: "Rafi Ahmed" })
    expect(screen.queryByLabelText("Choose a child")).toBeNull()
    expect(screen.getByText("Class 6, section A")).toBeTruthy()
  })

  it("explains when no student is linked", async () => {
    renderPortal([])
    expect(
      await screen.findByRole("heading", { name: "No students linked yet" })
    ).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/dashboard"),
      expect.anything()
    )
  })

  it("moves to a child's other school without signing in again", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    renderPortal([RAFI])

    await userEvent.click(
      screen.getByRole("button", { name: "Account menu for Karim Ahmed" })
    )
    const school = await screen.findByRole("menuitem", {
      name: /Beta High School/,
    })
    expect(within(school).getByText("Tania Ahmed")).toBeTruthy()
    await userEvent.click(school)

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        "http://beta.lvh.me:3000/auth/handoff?code=c"
      )
    )
    const call = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/portal/handoff")
    )
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ orgId: "org-2" })
  })

  it("reads in Bangla", async () => {
    renderPortal([RAFI], "bn")
    expect(await screen.findByText("উপস্থিত")).toBeTruthy()
    expect(screen.getByText("৯১.৭%")).toBeTruthy()
    expect(screen.getByText("৳১,৫০০")).toBeTruthy()
    expect(screen.getAllByText("একমি স্কুল").length).toBeGreaterThan(0)
  })
})
