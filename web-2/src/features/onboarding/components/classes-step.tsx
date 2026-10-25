"use client"

import { useQuery } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import {
  academicKeys,
  classesQuery,
  createClass,
  createSection,
  currentSessionQuery,
  sectionsQuery,
  type AcademicYear,
  type SchoolClass,
  type Section,
} from "~/features/academics/api"
import type { OnboardingStepKey } from "~/features/onboarding/api"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import { nextSectionName } from "../steps"
import { ContinueButton, StepLoadFailed, StepNote } from "./step-parts"
import { useSetupAction } from "../use-setup-action"

export interface StepProps {
  onContinue: () => void
  onGoTo: (key: OnboardingStepKey) => void
}

/**
 * Step 3: classes (permanent) and their sections in the current session.
 * Done once there is a class and the session has a section.
 */
export function ClassesStep({
  done,
  onContinue,
  onGoTo,
}: StepProps & { done: boolean }) {
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
  return (
    <ClassList
      session={session.data}
      done={done}
      onContinue={onContinue}
      onGoTo={onGoTo}
    />
  )
}

function ClassList({
  session,
  done,
  onContinue,
  onGoTo,
}: StepProps & { session: AcademicYear; done: boolean }) {
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

  return (
    <div className="flex flex-col gap-4">
      {classes.data.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
          <p className="text-sm">{t("templateHint")}</p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onGoTo("curriculum")}
          >
            {t("toTemplates")}
          </Button>
        </div>
      ) : (
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
      )}

      {bare.length > 0 && classes.data.length > 1 && (
        <Button
          variant="outline"
          className="self-start"
          disabled={addMissing.isPending}
          onClick={() => addMissing.mutate(bare)}
        >
          {addMissing.isPending ? <Spinner /> : <PlusIcon />}
          {t("addMissing", { count: bare.length, n: f.number(bare.length) })}
        </Button>
      )}

      <AddClassForm />
      {done && <ContinueButton onContinue={onContinue} />}
    </div>
  )
}

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
  const [name, setName] = useState(suggestion)
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim()) add.mutate(name.trim())
  }

  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{schoolClass.name}</span>
        <span className="flex flex-wrap gap-1">
          {sections.length ? (
            sections.map((s) => (
              <Badge key={s.id} variant="secondary">
                {t("section", { name: s.name })}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              {t("noSections")}
            </span>
          )}
        </span>
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Label htmlFor={inputId} className="sr-only">
          {t("sectionName", { className: schoolClass.name })}
        </Label>
        <Input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder={t("sectionPlaceholder")}
          className="w-24"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={add.isPending || !name.trim()}
        >
          {add.isPending ? <Spinner /> : <PlusIcon />}
          {t("addSection")}
        </Button>
      </form>
    </li>
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
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label htmlFor="class-name">{t("className")}</Label>
      <div className="flex gap-2">
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
      </div>
    </form>
  )
}
