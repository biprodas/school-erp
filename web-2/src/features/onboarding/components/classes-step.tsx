"use client"

import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import {
  academicKeys,
  classesQuery,
  createClass,
  createSection,
  currentSessionQuery,
  deleteClass,
  deleteSection,
  sectionsQuery,
  type AcademicYear,
  type SchoolClass,
  type Section,
} from "~/features/academics/api"
import type { OnboardingStepKey } from "~/features/onboarding/api"
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
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import { nextSectionName } from "../steps"
import { StepLoadFailed, StepNote } from "./step-parts"
import { useSetupAction } from "../use-setup-action"

export interface StepProps {
  onGoTo: (key: OnboardingStepKey) => void
}

/**
 * Step 4: sections for the classes (permanent; usually from the template
 * in the step before) in the current session. Done once there is a class
 * and the session has a section.
 */
export function ClassesStep({ onGoTo }: StepProps) {
  const t = useTranslations("onboarding.classes")
  const session = useQuery(currentSessionQuery())

  if (session.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (session.isError) return <StepLoadFailed retry={session.refetch} />
  if (!session.data) {
    return (
      <div className="flex flex-col gap-3">
        <StepNote tone="info">{t("needSession")}</StepNote>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => onGoTo("session")}
        >
          {t("toSession")}
        </Button>
      </div>
    )
  }
  return <ClassList session={session.data} onGoTo={onGoTo} />
}

function ClassList({ session, onGoTo }: StepProps & { session: AcademicYear }) {
  const t = useTranslations("onboarding.classes")
  const f = useSchoolFormat()
  const classes = useQuery(classesQuery())
  const sections = useQuery(sectionsQuery(session.id))
  const sectionsKey = academicKeys.sections(session.id)

  const addMissing = useSetupAction({
    action: (bare: SchoolClass[]) =>
      Promise.all(
        bare.map((c) =>
          createSection({
            academicYearId: session.id,
            classId: c.id,
            name: "A",
          })
        )
      ),
    invalidate: [sectionsKey],
    success: (created) =>
      t("sectionsAdded", {
        count: created.length,
        n: f.number(created.length),
      }),
  })

  if (classes.isPending || sections.isPending) {
    return <Skeleton className="h-48 rounded-lg" />
  }
  if (classes.isError || sections.isError) {
    return (
      <StepLoadFailed
        retry={() => Promise.all([classes.refetch(), sections.refetch()])}
      />
    )
  }

  const byClass = new Map<string, Section[]>()
  for (const s of sections.data) {
    byClass.set(s.classId, [...(byClass.get(s.classId) ?? []), s])
  }
  const bare = classes.data.filter((c) => !byClass.has(c.id))

  if (classes.data.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Section title={t("yours", { session: session.name })} hint="">
          <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
            <StepNote tone="info">{t("templateHint")}</StepNote>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => onGoTo("curriculum")}
            >
              <ArrowLeftIcon aria-hidden />
              {t("toTemplates")}
            </Button>
          </div>
        </Section>
        <AddClassForm />
      </div>
    )
  }

  const covered = classes.data.length - bare.length

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={t("yours", { session: session.name })}
        hint={t("covered", {
          count: classes.data.length,
          done: f.number(covered),
          total: f.number(classes.data.length),
        })}
        action={
          // The quick start: section A for every class without one.
          bare.length > 0 ? (
            <Button
              size="sm"
              variant={covered ? "outline" : "default"}
              disabled={addMissing.isPending}
              onClick={() => addMissing.mutate(bare)}
              className="h-auto min-h-8 py-1.5 text-left whitespace-normal"
            >
              {addMissing.isPending ? <Spinner /> : <PlusIcon aria-hidden />}
              {t(covered ? "addMissing" : "addToAll", {
                count: bare.length,
                n: f.number(bare.length),
              })}
            </Button>
          ) : (
            <Badge variant="secondary" className="h-8 px-3">
              <CheckIcon aria-hidden />
              {t("allCovered")}
            </Badge>
          )
        }
      >
        <ul
          className="flex flex-col divide-y rounded-lg border"
          aria-label={t("listLabel", { session: session.name })}
        >
          {classes.data.map((c) => (
            <ClassRow
              // Remounts with a fresh suggestion when its sections change.
              key={`${c.id}:${byClass.get(c.id)?.length ?? 0}`}
              schoolClass={c}
              sessionId={session.id}
              sections={byClass.get(c.id) ?? []}
            />
          ))}
        </ul>
      </Section>

      <AddClassForm />
    </div>
  )
}

/** A heading in the left column on wide screens, ruled off from the last. */
function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-t pt-6 first:border-t-0 first:pt-0 lg:flex">
      <div className="mb-3 flex flex-col gap-0.5 lg:mb-0 lg:w-44 lg:shrink-0 lg:pr-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

/**
 * One class in the register: its name, its sections as tiles, "+ B" to add
 * the next letter in one click, another name on demand, and removing the
 * class at the end of the row.
 */
function ClassRow({
  schoolClass,
  sessionId,
  sections,
}: {
  schoolClass: SchoolClass
  sessionId: string
  sections: Section[]
}) {
  const t = useTranslations("onboarding.classes")
  const suggestion = nextSectionName(sections.map((s) => s.name))
  const [naming, setNaming] = useState(!suggestion)
  const [name, setName] = useState("")
  const add = useSetupAction({
    action: (sectionName: string) =>
      createSection({
        academicYearId: sessionId,
        classId: schoolClass.id,
        name: sectionName,
      }),
    invalidate: [academicKeys.sections(sessionId)],
    success: null,
  })
  const inputId = `section-${schoolClass.id}`
  const empty = sections.length === 0

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim()) add.mutate(name.trim())
  }

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:flex">
      <span className="flex min-w-0 items-center gap-1.5 sm:w-32 sm:shrink-0">
        {empty && (
          <CircleAlertIcon
            aria-label={t("noSections")}
            className="size-3.5 shrink-0 text-highlight"
          />
        )}
        <span className="truncate text-sm font-medium">{schoolClass.name}</span>
      </span>
      <div className="col-span-2 row-start-2 flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {sections.length > 0 && (
          <ul
            className="contents"
            aria-label={t("sectionsOf", { className: schoolClass.name })}
          >
            {sections.map((s) => (
              <li key={s.id}>
                <SectionBadge
                  section={s}
                  className={schoolClass.name}
                  sessionId={sessionId}
                />
              </li>
            ))}
          </ul>
        )}
        {suggestion && (
          <button
            type="button"
            disabled={add.isPending}
            aria-label={t("addNamed", {
              name: suggestion,
              className: schoolClass.name,
            })}
            onClick={() => add.mutate(suggestion)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-xs font-medium transition-colors outline-none hover:border-solid hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
              empty
                ? "border-highlight text-foreground"
                : "border-muted-foreground/40 text-muted-foreground"
            )}
          >
            {add.isPending && add.variables === suggestion ? (
              <Spinner className="size-3" />
            ) : (
              <PlusIcon aria-hidden className="size-3" />
            )}
            {suggestion}
          </button>
        )}
        {naming ? (
          <form onSubmit={onSubmit} className="flex items-center gap-1">
            <Label htmlFor={inputId} className="sr-only">
              {t("sectionName", { className: schoolClass.name })}
            </Label>
            <Input
              id={inputId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && suggestion) setNaming(false)
              }}
              maxLength={60}
              autoFocus={Boolean(suggestion)}
              placeholder={t("otherNamePlaceholder")}
              className="h-7 w-28 text-xs"
            />
            <Button
              type="submit"
              variant="outline"
              size="xs"
              aria-label={t("addTo", { className: schoolClass.name })}
              disabled={add.isPending || !name.trim()}
            >
              {add.isPending && add.variables !== suggestion ? (
                <Spinner />
              ) : (
                <PlusIcon aria-hidden />
              )}
              {t("addSection")}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="h-7 rounded-md px-1.5 text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {t("otherName")}
          </button>
        )}
      </div>
      <span className="col-start-2 row-start-1">
        <RemoveClassButton schoolClass={schoolClass} sessionId={sessionId} />
      </span>
    </li>
  )
}

/** A section, with a button that removes it (refused once in use). */
function SectionBadge({
  section,
  className,
  sessionId,
}: {
  section: Section
  className: string
  sessionId: string
}) {
  const t = useTranslations("onboarding.classes")
  const remove = useSetupAction({
    action: () => deleteSection(section.id),
    invalidate: [academicKeys.sections(sessionId)],
    success: () => t("sectionRemoved", { name: section.name }),
  })

  return (
    <span className="flex h-7 min-w-9 items-center justify-center gap-1 rounded-md border bg-secondary pr-1 pl-2.5 text-sm font-semibold text-secondary-foreground">
      <span className="sr-only">{t("section", { name: "" })}</span>
      {section.name}
      <button
        type="button"
        aria-label={t("removeSection", { name: section.name, className })}
        title={t("removeSection", { name: section.name, className })}
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
  )
}

/**
 * Removes a class after a confirmation: its sections and class subjects
 * go with it (the backend cascades), and one with students is refused.
 */
function RemoveClassButton({
  schoolClass,
  sessionId,
}: {
  schoolClass: SchoolClass
  sessionId: string
}) {
  const t = useTranslations("onboarding.classes")
  const [open, setOpen] = useState(false)
  const remove = useSetupAction({
    action: () => deleteClass(schoolClass.id),
    invalidate: [academicKeys.classes, academicKeys.sections(sessionId)],
    success: () => t("classRemoved", { name: schoolClass.name }),
    onSuccess: () => setOpen(false),
  })

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("removeClass", { name: schoolClass.name })}
        title={t("removeClass", { name: schoolClass.name })}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden />
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => !remove.isPending && setOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("removeClassTitle", { name: schoolClass.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeClassBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined)}
            >
              {remove.isPending ? <Spinner /> : <Trash2Icon aria-hidden />}
              {t("confirmRemove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AddClassForm() {
  const t = useTranslations("onboarding.classes")
  const [name, setName] = useState("")
  const add = useSetupAction({
    action: createClass,
    invalidate: [academicKeys.classes],
    success: (created) => t("classAdded", { name: created.name }),
    onSuccess: () => setName(""),
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim()) add.mutate({ name: name.trim() })
  }

  return (
    <Section title={t("className")} hint={t("classHint")}>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Label htmlFor="class-name" className="sr-only">
          {t("className")}
        </Label>
        <Input
          id="class-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={t("classPlaceholder")}
          className="sm:max-w-xs"
        />
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          {add.isPending ? <Spinner /> : <PlusIcon />}
          {t("addClass")}
        </Button>
      </form>
    </Section>
  )
}
