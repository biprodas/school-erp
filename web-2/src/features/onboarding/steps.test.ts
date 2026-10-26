import { describe, expect, it } from "vitest"

import type {
  CurriculumTemplate,
  OnboardingChecklist,
  OnboardingStepKey,
} from "~/features/onboarding/api"

import {
  defaultSession,
  firstOpenStep,
  missingRequired,
  nextOpenStep,
  nextSectionName,
  billingMonths,
  sessionMonthOrder,
  sessionMonths,
  sessionPresets,
  sessionYears,
  sortTemplates,
} from "./steps"

const REQUIRED: OnboardingStepKey[] = [
  "profile",
  "session",
  "curriculum",
  "classes",
]
const ALL: OnboardingStepKey[] = [...REQUIRED, "grading", "fees", "staff"]

const checklist = (done: OnboardingStepKey[]): OnboardingChecklist => ({
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
  completedAt: null,
})

describe("firstOpenStep", () => {
  it("opens the first required step still to do", () => {
    expect(firstOpenStep(checklist([]))).toBe("profile")
    expect(firstOpenStep(checklist(["profile", "grading"]))).toBe("session")
  })

  it("then the first optional one, then the first step", () => {
    expect(firstOpenStep(checklist(REQUIRED))).toBe("grading")
    expect(firstOpenStep(checklist(ALL))).toBe("profile")
  })

  it("skips steps whose feature isn't there", () => {
    const list = checklist([])
    list.steps[0] = { ...list.steps[0]!, available: false }
    expect(firstOpenStep(list)).toBe("session")
  })
})

describe("nextOpenStep", () => {
  it("moves forward to the next step still to do", () => {
    expect(nextOpenStep(checklist(["profile"]), "profile")).toBe("session")
    expect(nextOpenStep(checklist(["session", "classes"]), "session")).toBe(
      "curriculum"
    )
  })

  it("past the end, goes back only to a required step still open", () => {
    expect(nextOpenStep(checklist(["staff"]), "staff")).toBe("profile")
    // Grading was skipped: it isn't offered again.
    const required = ["profile", "session", "curriculum", "classes"] as const
    expect(nextOpenStep(checklist([...required, "fees"]), "staff")).toBeNull()
  })

  it("closes everything when all is done", () => {
    expect(nextOpenStep(checklist(ALL), "fees")).toBeNull()
  })
})

it("missingRequired lists only required steps", () => {
  expect(
    missingRequired(checklist(["profile", "grading"])).map((s) => s.key)
  ).toEqual(["session", "curriculum", "classes"])
})

it("sortTemplates puts the school type's templates first", () => {
  const template = (code: string, suggestedFor: string[]) =>
    ({ code, suggestedFor }) as unknown as CurriculumTemplate
  const rows = sortTemplates(
    [
      template("nctb", ["school", "college"]),
      template("alia-madrasa", ["madrasa"]),
      template("cambridge", ["english_medium"]),
    ],
    "madrasa"
  )
  expect(rows.map((r) => [r.template.code, r.suggested])).toEqual([
    ["alia-madrasa", true],
    ["nctb", false],
    ["cambridge", false],
  ])
})

it("nextSectionName follows the letters already used", () => {
  expect(nextSectionName([])).toBe("A")
  expect(nextSectionName(["A"])).toBe("B")
  expect(nextSectionName(["a", "C", "B"])).toBe("D")
  // Named sections: the person types the next name.
  expect(nextSectionName(["Rose"])).toBe("")
})

it("sessionPresets offers the calendar year and the July–June year today is in", () => {
  expect(sessionPresets("2026-03-10")).toEqual([
    {
      key: "calendar",
      dates: { name: "2026", startDate: "2026-01-01", endDate: "2026-12-31" },
    },
    {
      key: "july",
      dates: {
        name: "2025–2026",
        startDate: "2025-07-01",
        endDate: "2026-06-30",
      },
    },
  ])
  expect(sessionPresets("2026-07-01")[1]!.dates.startDate).toBe("2026-07-01")
})

it("sessionMonthOrder starts the year at the session's first month", () => {
  expect(sessionMonthOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  expect(sessionMonthOrder(7)).toEqual([7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6])
})

it("billingMonths places each frequency in the school year", () => {
  expect(billingMonths("monthly")).toHaveLength(12)
  expect(billingMonths("quarterly")).toEqual([0, 3, 6, 9])
  expect(billingMonths("yearly")).toEqual([0])
  expect(billingMonths("one_time")).toEqual([])
})

it("sessionMonths and sessionYears describe a session", () => {
  expect(sessionMonths("2026-01-01", "2026-12-31")).toBe(12)
  expect(sessionMonths("2026-07-01", "2027-06-30")).toBe(12)
  expect(sessionMonths("2026-01-01", "2026-06-30")).toBe(6)
  expect(sessionYears("2026-07-01", "2027-06-30")).toEqual([2026, 2027])
  expect(sessionYears("2026-01-01", "2026-12-31")).toEqual([2026])
})

it("defaultSession spans the school's calendar year", () => {
  expect(defaultSession("2026-10-25")).toEqual({
    name: "2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  })
})
