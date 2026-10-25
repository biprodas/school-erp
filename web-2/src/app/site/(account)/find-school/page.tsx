import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { appConfig } from "~/config/app-config"
import { AccountPanel } from "~/features/signup/components/account-panel"
import { FindByAddressForm } from "~/features/signup/components/find-school-forms"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("findSchool")
  return { title: t("metaTitle") }
}

/**
 * `/find-school` on the apex, where "Sign in" on the marketing site leads:
 * sign-in happens on each school's own address, so this finds it. Someone
 * who doesn't know the address goes on to `/find-school/email`.
 */
export default async function FindSchoolPage() {
  const t = await getTranslations("findSchool")

  return (
    <>
      <AccountPanel title={t("title")} description={t("description")}>
        <div className="flex flex-col gap-4">
          <FindByAddressForm rootDomain={appConfig.rootDomain} />
          <p className="text-center text-sm text-muted-foreground">
            {t("emailTitle")}{" "}
            <a
              href="/find-school/email"
              className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {t("emailLink")}
            </a>
          </p>
        </div>
      </AccountPanel>
      <p className="text-center text-sm text-muted-foreground">
        {t("newSchool")}{" "}
        <a
          href="/signup"
          className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {t("signup")}
        </a>
      </p>
    </>
  )
}
