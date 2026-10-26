"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"

import {
  classesQuery,
  classSubjectsQuery,
  currentSessionQuery,
  sectionsQuery,
} from "~/features/academics/api"
import {
  feeHeadsQuery,
  gradingSystemsQuery,
  onboardingTemplatesQuery,
  staffQuery,
  type OnboardingStepKey,
} from "~/features/onboarding/api"
import { schoolSettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import { sessionMonths } from "../steps"

/**
 * What a done step set up, in a line or two ("School · Dhaka ·
 * 01712-345678 · EIIN 108256", "14 sections in 10 classes · 2 classes
 * without one"), from the data the step itself reads. Shows nothing while
 * it loads or if it can't (the step still reads "Done").
 */
export function StepDetail({ step }: { step: OnboardingStepKey }) {
  switch (step) {
    case "profile":
      return <ProfileDetail />
    case "session":
      return <SessionDetail />
    case "curriculum":
      return <CurriculumDetail />
    case "classes":
      return <SectionsDetail />
    case "grading":
      return <GradingDetail />
    case "fees":
      return <FeesDetail />
    case "staff":
      return <StaffDetail />
  }
}

/** The parts that have a value, as one line (wrapping to two at most). */
function Line({ parts }: { parts: (string | false | null | undefined)[] }) {
  const shown = parts.filter(Boolean)
  if (!shown.length) return null
  return (
    <span className="line-clamp-2 text-xs text-muted-foreground">
      {shown.join(" · ")}
    </span>
  )
}

/** "Tuition Fee, Exam Fee, Lab Fee and 3 more". */
function useFewNames() {
  const t = useTranslations("onboarding.finish.details")
  const f = useSchoolFormat()
  return (names: string[], shown = 3) =>
    names.length > shown
      ? t("andMore", {
          names: names.slice(0, shown).join(", "),
          n: f.number(names.length - shown),
        })
      : names.join(", ")
}

function ProfileDetail() {
  const t = useTranslations("onboarding.finish.details")
  const tp = useTranslations("onboarding.profile")
  const { data } = useQuery(schoolSettingsQuery())
  if (!data) return null
  const { organization, profile } = data
  const { address } = profile
  const place = [address.area, address.district].filter(Boolean).join(", ")
  return (
    <Line
      parts={[
        tp(`types.${organization.type}`),
        place || address.line1,
        profile.phone,
        profile.email,
        organization.eiin && t("eiin", { eiin: organization.eiin }),
      ]}
    />
  )
}

function SessionDetail() {
  const f = useSchoolFormat()
  const ts = useTranslations("onboarding.session")
  const { data } = useQuery(currentSessionQuery())
  if (!data) return null
  const { name, startDate, endDate } = data
  if (!startDate || !endDate) return <Line parts={[name]} />
  const months = sessionMonths(startDate, endDate)
  return (
    <Line
      parts={[
        name,
        `${f.date(startDate)} – ${f.date(endDate)}`,
        ts("months", { count: months, n: f.number(months) }),
      ]}
    />
  )
}

function CurriculumDetail() {
  const t = useTranslations("onboarding.finish.details")
  const f = useSchoolFormat()
  const templates = useQuery(onboardingTemplatesQuery())
  const classes = useQuery(classesQuery())
  const session = useQuery(currentSessionQuery())
  const subjects = useQuery({
    ...classSubjectsQuery(session.data?.id ?? ""),
    enabled: Boolean(session.data),
  })
  if (!classes.data) return null
  const template = templates.data?.curriculum.find(
    (c) => c.code === templates.data?.curriculumInUse
  )
  // Subjects by name: the same subject in several classes counts once.
  const distinct = new Set(subjects.data?.map((s) => s.subjectId)).size
  return (
    <Line
      parts={[
        template?.name,
        t("classes", {
          count: classes.data.length,
          n: f.number(classes.data.length),
        }),
        subjects.data &&
          t("subjects", { count: distinct, n: f.number(distinct) }),
      ]}
    />
  )
}

function SectionsDetail() {
  const t = useTranslations("onboarding.finish.details")
  const f = useSchoolFormat()
  const session = useQuery(currentSessionQuery())
  const classes = useQuery(classesQuery())
  const sections = useQuery({
    ...sectionsQuery(session.data?.id ?? ""),
    enabled: Boolean(session.data),
  })
  if (!sections.data) return null
  const covered = new Set(sections.data.map((s) => s.classId))
  const without = (classes.data ?? []).filter((c) => !covered.has(c.id))
  return (
    <Line
      parts={[
        t("sections", {
          count: sections.data.length,
          n: f.number(sections.data.length),
          classes: f.number(covered.size),
        }),
        without.length > 0 &&
          t("withoutSection", {
            count: without.length,
            n: f.number(without.length),
          }),
      ]}
    />
  )
}

function GradingDetail() {
  const t = useTranslations("onboarding.finish.details")
  const tg = useTranslations("onboarding.grading")
  const f = useSchoolFormat()
  const { data } = useQuery(gradingSystemsQuery())
  const main = data?.find((s) => s.isDefault) ?? data?.[0]
  if (!data || !main) return null
  const top = Math.max(0, ...main.items.map((b) => b.point))
  const others = data.length - 1
  return (
    <Line
      parts={[
        t("grading", { name: main.name }),
        main.kind === "gpa"
          ? tg("kinds.gpa", { scale: f.number(top) })
          : tg(`kinds.${main.kind}`),
        t("grades", {
          count: main.items.length,
          n: f.number(main.items.length),
        }),
        others > 0 && t("otherSystems", { count: others, n: f.number(others) }),
      ]}
    />
  )
}

function FeesDetail() {
  const t = useTranslations("onboarding.finish.details")
  const f = useSchoolFormat()
  const few = useFewNames()
  const { data } = useQuery(feeHeadsQuery())
  if (!data) return null
  const monthly = data.filter((h) => h.frequency === "monthly").length
  return (
    <Line
      parts={[
        t("fees", { count: data.length, n: f.number(data.length) }),
        monthly > 0 && t("monthly", { count: monthly, n: f.number(monthly) }),
        few(data.map((h) => h.name)),
      ]}
    />
  )
}

function StaffDetail() {
  const t = useTranslations("onboarding.finish.details")
  const f = useSchoolFormat()
  const few = useFewNames()
  const { data } = useQuery(staffQuery())
  if (!data) return null
  const withLogin = data.filter((s) => s.userId).length
  return (
    <Line
      parts={[
        t("staff", { count: data.length, n: f.number(data.length) }),
        t("logins", { count: withLogin, n: f.number(withLogin) }),
        few(
          data.map((s) => s.fullName),
          2
        ),
      ]}
    />
  )
}
