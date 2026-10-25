"use client"

import { RefreshCwIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useActionState } from "react"

import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { IDLE } from "~/lib/forms/form-state"

import { recheckOnboarding } from "./actions"
import { SignOutButton } from "./sign-out-button"

/** "Check again" (moves on once onboarding is done) and sign out. */
export function SettingUpActions() {
  const t = useTranslations("auth.settingUp")
  const [state, formAction, pending] = useActionState(recheckOnboarding, IDLE)

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : <RefreshCwIcon />}
          {t("checkAgain")}
        </Button>
      </form>
      {state.status === "error" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("stillOpen")}
        </p>
      )}
      <SignOutButton variant="ghost" />
    </div>
  )
}
