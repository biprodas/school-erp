import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"

import { getSchoolHome, schoolName } from "~/features/school-site/api"
import { SchoolRule } from "~/features/auth/components/school-rule"
import { SettingUpActions } from "~/features/auth/components/setting-up-actions"
import {
  SetupProgress,
  type SetupProgressData,
} from "~/features/auth/components/setup-progress"
import { backendFetch } from "~/lib/api/server"
import { getSession } from "~/lib/auth"
import { requireSchoolSlug } from "~/lib/tenancy/request-host"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.settingUp")
  return { title: t("metaTitle") }
}

/**
 * `/setting-up`: where staff wait while the school's admins finish
 * onboarding (the proxy sends them here, and away once it is done). It
 * says whose school it is and who is signed in, shows how far setup has
 * got, and checks by itself, so they're taken in when it ends.
 */
export default async function SettingUpPage() {
  const home = await getSchoolHome(await requireSchoolSlug())
  const school = schoolName(home, await getLocale())
  const t = await getTranslations("auth.settingUp")
  const user = (await getSession())?.user
  const progress = await readProgress()
  const contact = [home.contact?.phone, home.contact?.email]
    .filter(Boolean)
    .join(", ")

  return (
    <>
      <article
        aria-labelledby="setting-up-title"
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <header className="flex flex-col gap-2 bg-primary/[0.04] px-6 pt-7 pb-6 sm:px-9 sm:pt-9">
          {user && (
            <p className="truncate text-sm text-muted-foreground">
              {t("signedInAs", {
                account: user.name ?? user.email ?? user.phone ?? "",
              })}
            </p>
          )}
          <h1
            id="setting-up-title"
            className="font-display text-3xl leading-tight font-semibold text-balance"
          >
            {t("title", { school })}
          </h1>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </header>
        <SchoolRule />
        <div className="flex flex-col gap-6 px-6 pt-6 pb-7 sm:px-9 sm:pb-9">
          {progress && <SetupProgress progress={progress} />}
          <SettingUpActions />
        </div>
      </article>
      {contact && (
        <p className="text-center text-sm text-muted-foreground">
          {t("contact", { school, contact })}
        </p>
      )}
    </>
  )
}

/** Setup's progress, or null when it can't be read (the page still works). */
async function readProgress(): Promise<SetupProgressData | null> {
  try {
    return await backendFetch<SetupProgressData>("/onboarding/progress")
  } catch (error) {
    console.warn("[setting-up] couldn't read setup progress", error)
    return null
  }
}
