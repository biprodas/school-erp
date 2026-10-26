"use client"

import { RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { startTransition, useActionState, useEffect } from "react"

import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { IDLE } from "~/lib/forms/form-state"

import { recheckOnboarding } from "../actions"
import { SignOutButton } from "./sign-out-button"

/** How often the page asks by itself whether setup is done. */
const POLL_MS = 30_000

/**
 * "Check now" (moves on once onboarding is done) and sign out. It also
 * checks by itself every 30 s and when the tab regains focus, so staff
 * move on soon after an admin finishes or skips setup; each check also
 * refreshes the progress shown above.
 */
export function SettingUpActions() {
  const t = useTranslations("auth.settingUp")
  const router = useRouter()
  const [state, formAction, pending] = useActionState(recheckOnboarding, IDLE)

  useEffect(() => {
    // Called directly, the action redirects once setup is done and
    // otherwise answers quietly (the "not ready" line is for the button).
    const check = () => {
      if (document.visibilityState === "visible") {
        startTransition(async () => {
          await recheckOnboarding()
          router.refresh()
        })
      }
    }
    const timer = window.setInterval(check, POLL_MS)
    window.addEventListener("focus", check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", check)
    }
  }, [router])

  useEffect(() => {
    if (state.status === "error") router.refresh()
  }, [state, router])

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span aria-hidden className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {t("autoCheck")}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={formAction} className="sm:flex-1">
          <Button
            type="submit"
            size="lg"
            variant="outline"
            className="w-full"
            disabled={pending}
          >
            {pending ? <Spinner /> : <RefreshCwIcon />}
            {t("checkAgain")}
          </Button>
        </form>
        <SignOutButton variant="ghost" className="sm:flex-1" />
      </div>
      {state.status === "error" && !pending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("stillOpen")}
        </p>
      )}
    </div>
  )
}
