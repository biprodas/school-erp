import { CheckIcon, CircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Progress } from "~/components/ui/progress"

/** `GET /onboarding/progress`: setup's steps without titles or links. */
export interface SetupProgressData {
  steps: { key: string; required: boolean; done: boolean }[]
  percentage: number
  completedAt: string | null
}

/**
 * How far the school's setup has got, for staff waiting on it: a bar and
 * each step, done or still open, by the name the admins see in the wizard.
 */
export function SetupProgress({ progress }: { progress: SetupProgressData }) {
  const t = useTranslations("auth.settingUp")
  const ts = useTranslations("onboarding.steps")
  const done = progress.steps.filter((s) => s.done).length
  // Every required step done: only an admin's "Finish setup" is left.
  const ready = progress.steps.every((s) => !s.required || s.done)
  const title = (key: string) =>
    ts.has(`${key}.title` as never) ? ts(`${key}.title` as never) : key

  return (
    <section aria-labelledby="setup-progress" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="setup-progress" className="font-semibold">
          {t("progressTitle")}
        </h2>
        <span className="text-sm text-muted-foreground">
          {t("progressCount", { done, total: progress.steps.length })}
        </span>
      </div>
      <Progress value={progress.percentage} aria-labelledby="setup-progress" />
      <ul className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {progress.steps.map((step) => (
          <li
            key={step.key}
            className={
              step.done
                ? "flex items-center gap-2"
                : "flex items-center gap-2 text-muted-foreground"
            }
          >
            {step.done ? (
              <CheckIcon
                aria-hidden
                className="size-3.5 shrink-0 text-primary"
                strokeWidth={3}
              />
            ) : (
              <CircleIcon aria-hidden className="size-3.5 shrink-0" />
            )}
            {title(step.key)}
            <span className="sr-only">
              {step.done ? t("stepDone") : t("stepOpen")}
            </span>
          </li>
        ))}
      </ul>
      {ready && (
        <p className="text-sm text-muted-foreground">{t("readyToFinish")}</p>
      )}
    </section>
  )
}
