"use client"

import { useQuery } from "@tanstack/react-query"
import { LogOutIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { onboardingChecklistQuery } from "~/features/onboarding/api"
import { displayName, displaySettingsQuery } from "~/features/settings/api"
import { LanguageSwitch } from "~/components/common/language-switch"
import { SchoolLogo } from "~/components/common/school-logo"
import { ThemeToggle } from "~/components/common/theme-toggle"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import { Spinner } from "~/components/ui/spinner"
import { signOut } from "~/features/auth/sign-out"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { brandStyle } from "~/lib/brand-colors"

/**
 * Around `/onboarding`: no sidebar (the staff app isn't open yet), the
 * school's name and colors, the progress from the checklist, language,
 * theme and sign-out.
 */
export function OnboardingShell({
  schoolName,
  children,
}: {
  /** Until the display settings load (and if they can't). */
  schoolName: string
  children: React.ReactNode
}) {
  const t = useTranslations("onboarding")
  const tc = useTranslations("common")
  const locale = useLocale()
  const display = useQuery(displaySettingsQuery())
  const name = display.data ? displayName(display.data, locale) : schoolName
  const [signingOut, setSigningOut] = useState(false)

  return (
    <div
      className="flex min-h-svh flex-col bg-muted/40"
      style={brandStyle(display.data?.colors.primary)}
    >
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <SchoolLogo
            name={name}
            logoUrl={display.data?.logoUrl ?? null}
            alt=""
            className="size-8"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">
              {t("shellTitle")}
            </span>
          </div>
          <LanguageSwitch compact />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label={tc("signOut")}
            title={tc("signOut")}
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true)
              void signOut()
            }}
          >
            {signingOut ? <Spinner /> : <LogOutIcon />}
          </Button>
        </div>
        <SetupProgress />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16">
        {children}
      </main>
    </div>
  )
}

/** "60% done" and a bar, from the checklist's `percentage`. */
function SetupProgress() {
  const t = useTranslations("onboarding")
  const f = useSchoolFormat()
  const { data } = useQuery(onboardingChecklistQuery())
  const percentage = data?.percentage ?? 0

  return (
    <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-3">
      <Progress
        value={percentage}
        aria-label={t("progress")}
        aria-valuetext={t("percentDone", { percentage: f.number(percentage) })}
        className="flex-1"
      />
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {t("percentDone", { percentage: f.number(percentage) })}
      </span>
    </div>
  )
}
