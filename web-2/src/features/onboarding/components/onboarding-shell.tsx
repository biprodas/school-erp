"use client"

import { useQuery } from "@tanstack/react-query"
import { LogOutIcon, MonitorSmartphoneIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { meQuery } from "~/features/auth/api"
import { onboardingChecklistQuery } from "~/features/onboarding/api"
import { displayName, displaySettingsQuery } from "~/features/settings/api"
import { InitialsAvatar } from "~/components/common/initials-avatar"
import { LanguageSwitch } from "~/components/common/language-switch"
import { SchoolLogo } from "~/components/common/school-logo"
import { ThemeToggle } from "~/components/common/theme-toggle"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Progress } from "~/components/ui/progress"
import { signOut } from "~/features/auth/sign-out"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { brandStyle } from "~/lib/brand-colors"

/**
 * Around `/onboarding`: no sidebar (the staff app isn't open yet), the
 * school's name and colors, the progress from the checklist, language,
 * theme and the account menu.
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
  const locale = useLocale()
  const display = useQuery(displaySettingsQuery())
  const name = display.data ? displayName(display.data, locale) : schoolName

  return (
    <div
      className="flex min-h-svh flex-col bg-muted/40"
      style={brandStyle(display.data?.colors.primary)}
    >
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <SchoolLogo
            name={name}
            logoUrl={display.data?.logoUrl ?? null}
            alt=""
            className="size-9"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold sm:text-base">
              {name}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("shellTitle")}
            </span>
          </div>
          <SetupProgress />
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSwitch />
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
        <HeaderProgressBar />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 sm:px-6 lg:pt-10">
        {children}
      </main>
    </div>
  )
}

const useChecklistPercentage = () =>
  useQuery(onboardingChecklistQuery()).data?.percentage ?? 0

/** "60% done" next to a small ring, from the checklist's `percentage`. */
function SetupProgress() {
  const t = useTranslations("onboarding")
  const f = useSchoolFormat()
  const percentage = useChecklistPercentage()
  const label = t("percentDone", { percentage: f.number(percentage) })
  const radius = 9
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 max-md:hidden"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-6 -rotate-90">
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          strokeWidth="3"
          className="stroke-muted"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percentage / 100)}
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="text-xs font-medium tabular-nums">{label}</span>
    </div>
  )
}

/** The progress as a thin bar along the header's bottom edge. */
function HeaderProgressBar() {
  const t = useTranslations("onboarding")
  const f = useSchoolFormat()
  const percentage = useChecklistPercentage()
  return (
    <Progress
      value={percentage}
      aria-label={t("progress")}
      aria-valuetext={t("percentDone", { percentage: f.number(percentage) })}
      className="-mb-px block [&_[data-slot=progress-track]]:h-0.5 [&_[data-slot=progress-track]]:rounded-none [&_[data-slot=progress-track]]:bg-transparent"
    />
  )
}

/**
 * Who is signed in, and signing out. The staff app's pages (account,
 * other schools) aren't open during setup, so only these.
 */
function AccountMenu() {
  const t = useTranslations("shell.userMenu")
  const me = useQuery(meQuery())
  const [signingOut, setSigningOut] = useState(false)
  const name = me.data?.name ?? me.data?.email ?? me.data?.phone ?? ""
  const contact = me.data?.email ?? me.data?.phone

  function leave(everywhere: boolean) {
    setSigningOut(true)
    void signOut({ everywhere })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t("label", { name })}
          />
        }
      >
        <InitialsAvatar name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {name && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5 text-foreground">
                <span className="truncate text-sm font-medium">{name}</span>
                {contact && contact !== name && (
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {contact}
                  </span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={signingOut} onClick={() => leave(false)}>
            <LogOutIcon />
            {t("signOut")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onClick={() => leave(true)}
          >
            <MonitorSmartphoneIcon />
            {t("signOutEverywhere")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
