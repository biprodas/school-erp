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
  sortTemplates,
} from "./steps"

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
  it("moves to the next step still to do, wrapping around", () => {
    expect(nextOpenStep(checklist(["profile"]), "profile")).toBe("session")
    expect(nextOpenStep(checklist(["session", "classes"]), "session")).toBe(
      "curriculum"
    )
    expect(nextOpenStep(checklist(["students"]), "students")).toBe("profile")
  })

  it("closes everything when all is done", () => {
    expect(nextOpenStep(checklist(ALL), "fees")).toBeNull()
  })
})

it("missingRequired lists only required steps", () => {
  expect(
    missingRequired(checklist(["profile", "grading"])).map((s) => s.key)
  ).toEqual(["session", "classes", "curriculum"])
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

it("defaultSession spans the school's calendar year", () => {
  expect(defaultSession("2026-10-25")).toEqual({
    name: "2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  })
})
