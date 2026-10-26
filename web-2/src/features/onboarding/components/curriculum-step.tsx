"use client"

import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import {
  academicKeys,
  classesQuery,
  classSubjectsQuery,
  currentSessionQuery,
  deleteClassSubject,
  type AcademicYear,
  type ClassSubject,
  type SchoolClass,
} from "~/features/academics/api"
import {
  applyCurriculumTemplate,
  onboardingKeys,
  switchCurriculumTemplate,
  type CurriculumTemplate,
} from "~/features/onboarding/api"
import { schoolSettingsQuery } from "~/features/settings/api"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import { sortTemplates } from "../steps"
import { StepLoadFailed, StepNote } from "./step-parts"
import { WithTemplates } from "./template-steps"
import { useSetupAction } from "../use-setup-action"

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Step 3: classes and their subjects, from a curriculum template. Each
 * class shows a bar of its subjects by kind (open it to see and remove
 * them); the templates show their classes as a ladder. Applying adds the
 * template's classes, which the next step gives sections; class subjects
 * go into the current session, so without one only subjects and classes
 * are added.
 */
export function CurriculumStep() {
  const t = useTranslations("onboarding.curriculum")
  const session = useQuery(currentSessionQuery())
  const classes = useQuery(classesQuery())

  if (session.isPending || classes.isPending) {
    return <Skeleton className="h-48 rounded-lg" />
  }
  if (session.isError || classes.isError) {
    return (
      <StepLoadFailed
        retry={() => Promise.all([session.refetch(), classes.refetch()])}
      />
    )
  }

  // With no classes yet, choosing a template is the job, so it comes first.
  const yours =
    session.data && classes.data.length > 0 ? (
      <YourClasses session={session.data} classes={classes.data} />
    ) : null
  return (
    <div className="flex flex-col gap-6">
      {!session.data && <StepNote tone="info">{t("needSession")}</StepNote>}
      {yours}
      <Templates session={session.data} classes={classes.data} />
    </div>
  )
}

/** A heading in the left column on wide screens, ruled off from the last. */
function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t pt-6 first:border-t-0 first:pt-0 lg:flex">
      <div className="mb-3 flex flex-col gap-0.5 lg:mb-0 lg:w-44 lg:shrink-0 lg:pr-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

const KINDS: ClassSubject["subjectType"][] = [
  "compulsory",
  "optional",
  "fourth",
  "elective",
]

/**
 * A color per kind of class subject, apart from the green of the buttons
 * and steps: compulsory blue, optional (religion) amber, 4th subject
 * violet, elective teal.
 */
const KIND_COLOR: Record<ClassSubject["subjectType"], string> = {
  compulsory: "bg-sky-600 dark:bg-sky-500",
  optional: "bg-highlight",
  fourth: "bg-violet-500",
  elective: "bg-teal-500",
}

/** Each class with its subjects in the session, as bars by kind. */
function YourClasses({
  session,
  classes,
}: {
  session: AcademicYear
  classes: SchoolClass[]
}) {
  const t = useTranslations("onboarding.curriculum")
  const f = useSchoolFormat()
  const subjects = useQuery(classSubjectsQuery(session.id))

  if (subjects.isPending) return <Skeleton className="h-32 rounded-lg" />
  if (subjects.isError) return <StepLoadFailed retry={subjects.refetch} />

  const byClass = new Map<string, ClassSubject[]>()
  for (const s of subjects.data) {
    byClass.set(s.classId, [...(byClass.get(s.classId) ?? []), s])
  }
  const covered = classes.filter((c) => byClass.has(c.id)).length
  const most = Math.max(1, ...[...byClass.values()].map((list) => list.length))
  const kinds = KINDS.filter((kind) =>
    subjects.data.some((s) => s.subjectType === kind)
  )

  return (
    <Section
      title={t("yours", { session: session.name })}
      hint={t("covered", {
        count: classes.length,
        done: f.number(covered),
        total: f.number(classes.length),
      })}
    >
      <div className="flex flex-col gap-2">
        <ul
          className="flex flex-col divide-y rounded-lg border"
          aria-label={t("yoursLabel", { session: session.name })}
        >
          {classes.map((c) => (
            <ClassSubjectsRow
              key={c.id}
              schoolClass={c}
              sessionId={session.id}
              subjects={byClass.get(c.id) ?? []}
              most={most}
            />
          ))}
        </ul>
        {kinds.length > 1 && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {kinds.map((kind) => (
              <span key={kind} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-sm", KIND_COLOR[kind])}
                />
                {t(`kinds.${kind}`)}
              </span>
            ))}
          </p>
        )}
      </div>
    </Section>
  )
}

/**
 * A class: its name, a bar of its subjects by kind (as long as its count
 * against the fullest class) and the count; open it for the subjects.
 */
function ClassSubjectsRow({
  schoolClass,
  sessionId,
  subjects,
  most,
}: {
  schoolClass: SchoolClass
  sessionId: string
  subjects: ClassSubject[]
  /** The most subjects any class has, for the bar's scale. */
  most: number
}) {
  const t = useTranslations("onboarding.curriculum")
  const f = useSchoolFormat()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const sorted = [...subjects].sort(
    (a, b) =>
      KINDS.indexOf(a.subjectType) - KINDS.indexOf(b.subjectType) ||
      a.subject.name.localeCompare(b.subject.name)
  )
  const counts = KINDS.map((kind) => ({
    kind,
    n: subjects.filter((s) => s.subjectType === kind).length,
  })).filter((c) => c.n > 0)

  return (
    <li className={cn(open && "bg-muted/50")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={!subjects.length}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="flex w-24 shrink-0 items-center gap-1.5 sm:w-32">
          {!subjects.length && (
            <CircleAlertIcon
              aria-hidden
              className="size-3.5 shrink-0 text-highlight"
            />
          )}
          <span className="truncate text-sm font-medium">
            {schoolClass.name}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          {subjects.length ? (
            <>
              {/* Its own track, so the length stays true to the count. */}
              <span aria-hidden className="flex min-w-0 flex-1">
                <span
                  className="flex h-2.5 overflow-hidden rounded-full"
                  style={{ width: `${(subjects.length / most) * 100}%` }}
                >
                  {counts.map(({ kind, n }) => (
                    <span
                      key={kind}
                      className={cn("h-full", KIND_COLOR[kind])}
                      style={{ flex: `${n} 0 0` }}
                    />
                  ))}
                </span>
              </span>
              <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {t("subjectCount", {
                  count: subjects.length,
                  n: f.number(subjects.length),
                })}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("noSubjects")}
            </span>
          )}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
            !subjects.length && "invisible"
          )}
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="border-t border-border/60 px-3 py-2.5"
      >
        {open && (
          <ul
            className="flex flex-wrap gap-1"
            aria-label={t("subjectsOf", { className: schoolClass.name })}
          >
            {sorted.map((s) => (
              <SubjectChip
                key={s.id}
                classSubject={s}
                className={schoolClass.name}
                sessionId={sessionId}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

/**
 * A class subject, marked with its kind's color (and named when not
 * compulsory), with its group, and a remove button.
 */
function SubjectChip({
  classSubject,
  className,
  sessionId,
}: {
  classSubject: ClassSubject
  className: string
  sessionId: string
}) {
  const t = useTranslations("onboarding.curriculum")
  const name = classSubject.subject.name
  const remove = useSetupAction({
    action: () => deleteClassSubject(classSubject.id),
    invalidate: [academicKeys.classSubjects(sessionId)],
    success: () => t("subjectRemoved", { name, className }),
  })
  const extra = [
    classSubject.subjectType !== "compulsory" &&
      t(`types.${classSubject.subjectType}`),
    classSubject.subjectGroup?.name,
  ].filter(Boolean)

  return (
    <li>
      <span className="flex h-6 items-center gap-1.5 rounded-md border bg-background pr-0.5 pl-1.5 text-xs">
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-sm",
            KIND_COLOR[classSubject.subjectType]
          )}
        />
        <span className="font-medium">{name}</span>
        {extra.length > 0 && (
          <span className="text-muted-foreground">({extra.join(", ")})</span>
        )}
        <button
          type="button"
          aria-label={t("removeSubject", { name, className })}
          title={t("removeSubject", { name, className })}
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined)}
          className="flex size-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
        >
          {remove.isPending ? (
            <Spinner className="size-2.5" />
          ) : (
            <XIcon aria-hidden className="size-2.5" strokeWidth={2.5} />
          )}
        </button>
      </span>
    </li>
  )
}

function Templates({
  session,
  classes,
}: {
  session: AcademicYear | null
  classes: SchoolClass[]
}) {
  const t = useTranslations("onboarding.curriculum")
  const settings = useQuery(schoolSettingsQuery())

  return (
    <WithTemplates>
      {(templates) => {
        // One template per school. Once its classes are there it is marked
        // in use (applying it again adds anything missing), and choosing
        // another switches: the old one's data goes, the new one's comes.
        // With no classes left, the school may start over with any. The
        // order stays put either way, so switching doesn't move the cards.
        const locked = templates.curriculum.find(
          (c) => c.code === templates.curriculumInUse && classes.length > 0
        )
        const rows = sortTemplates(
          templates.curriculum,
          settings.data?.organization.type
        )

        return (
          <Section
            title={locked ? t("yourTemplate") : t("choose")}
            hint={locked ? t("onlyOne", { name: locked.name }) : t("chooseOne")}
          >
            <div className="flex flex-col gap-2">
              <ul
                className="flex flex-col divide-y rounded-lg border"
                aria-label={t("listLabel")}
              >
                {rows.map(({ template, suggested }) => (
                  <TemplateOption
                    key={template.code}
                    template={template}
                    suggested={suggested}
                    inUse={template === locked}
                    replaces={locked && template !== locked ? locked : null}
                    session={session}
                    classes={classes}
                  />
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t("hint")}</p>
            </div>
          </Section>
        )
      }}
    </WithTemplates>
  )
}

/** "Class 6" → "6", "Year 10" → "10"; else the name's first letters. */
const shortClassName = (name: string) =>
  /(\d+)\s*$/.exec(name)?.[1] ?? name.slice(0, 3)

/**
 * A curriculum template: what it is, its classes as a ladder of tiles
 * (ticked when the school has one by that name) with its groups, and
 * applying it (again, when in use, to add anything missing), or switching
 * to it from the one in use.
 */
function TemplateOption({
  template,
  suggested,
  inUse,
  replaces,
  session,
  classes,
}: {
  template: CurriculumTemplate
  suggested: boolean
  inUse: boolean
  /** The template in use, when choosing this one switches from it. */
  replaces: CurriculumTemplate | null
  session: AcademicYear | null
  classes: SchoolClass[]
}) {
  const t = useTranslations("onboarding.curriculum")
  const f = useSchoolFormat()
  const [confirming, setConfirming] = useState(false)
  const invalidate = [
    onboardingKeys.templates,
    academicKeys.classes,
    ...(session
      ? [
          academicKeys.classSubjects(session.id),
          academicKeys.sections(session.id),
        ]
      : []),
  ]
  const apply = useSetupAction({
    action: applyCurriculumTemplate,
    invalidate,
    success: ({ created }) =>
      created.classes + created.subjects + created.classSubjects === 0
        ? t("alreadyApplied")
        : t("applied", {
            classes: f.number(created.classes),
            subjects: f.number(created.classSubjects),
          }),
  })
  const switchTo = useSetupAction({
    action: switchCurriculumTemplate,
    invalidate,
    success: ({ removed, created }) =>
      t("switched", {
        name: template.name,
        removed: f.number(removed.classes),
        added: f.number(created.classes),
      }),
    onSuccess: () => setConfirming(false),
  })
  const has = (name: string) => classes.some((c) => sameName(c.name, name))
  const pending = apply.isPending || switchTo.isPending

  return (
    <li
      className={cn(
        "flex flex-col gap-3 p-3 sm:flex-row sm:items-start",
        inUse && "bg-primary/5"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {template.name}
            {inUse ? (
              <Badge>
                <CheckIcon aria-hidden />
                {t("inUse")}
              </Badge>
            ) : (
              suggested && <Badge variant="secondary">{t("suggested")}</Badge>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {template.description}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ul
            className="flex flex-wrap gap-1"
            aria-label={t("templateClasses", { name: template.name })}
          >
            {template.classes.map((name) => (
              <li
                key={name}
                title={name}
                className={cn(
                  "flex h-6 min-w-6 items-center justify-center gap-0.5 rounded px-1.5 text-[11px] font-semibold tabular-nums",
                  has(name)
                    ? "bg-secondary text-secondary-foreground"
                    : "border border-dashed border-muted-foreground/40 text-muted-foreground"
                )}
              >
                <span aria-hidden>{shortClassName(name)}</span>
                <span className="sr-only">
                  {name}
                  {has(name) && ` (${t("youHaveIt")})`}
                </span>
              </li>
            ))}
          </ul>
          <span className="text-xs text-muted-foreground">
            {t("contents", {
              classes: f.number(template.classes.length),
              subjects: f.number(template.subjects),
            })}
            {template.groups.length > 0 &&
              ` · ${t("groups", { groups: template.groups.join(", ") })}`}
          </span>
        </div>
      </div>
      {/* A fixed column, so the ladders of the list line up. */}
      <div className="flex shrink-0 sm:w-40 sm:justify-end">
        {replaces ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            aria-label={`${t("switch")}: ${template.name}`}
            onClick={() => setConfirming(true)}
          >
            <ArrowLeftRightIcon aria-hidden />
            {t("switch")}
          </Button>
        ) : (
          <Button
            variant={inUse ? "ghost" : "outline"}
            size="sm"
            disabled={pending}
            aria-label={`${inUse ? t("reapply") : t("apply")}: ${template.name}`}
            onClick={() => apply.mutate(template.code)}
          >
            {apply.isPending && <Spinner />}
            {inUse ? t("reapply") : t("apply")}
          </Button>
        )}
      </div>
      {replaces && (
        <AlertDialog
          open={confirming}
          onOpenChange={(open) => !switchTo.isPending && setConfirming(open)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("switchTitle", { name: template.name })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("switchBody", { from: replaces.name, to: template.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={switchTo.isPending}>
                {t("cancel")}
              </AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={switchTo.isPending}
                onClick={() => switchTo.mutate(template.code)}
              >
                {switchTo.isPending ? (
                  <Spinner />
                ) : (
                  <ArrowLeftRightIcon aria-hidden />
                )}
                {t("confirmSwitch")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  )
}
