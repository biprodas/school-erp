import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { AccountPanel } from "~/features/signup/components/account-panel"
import { FindByEmailForm } from "~/features/signup/components/find-school-forms"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("findSchool")
  return { title: t("emailPageTitle") }
}

/**
 * `/find-school/email`: for someone who doesn't know their school's
 * address. Emails a sign-in link for each school of the account.
 */
export default async function FindSchoolByEmailPage() {
  const t = await getTranslations("findSchool")

  return (
    <>
      <AccountPanel
        title={t("emailPageTitle")}
        description={t("emailDescription")}
      >
        <FindByEmailForm />
      </AccountPanel>
      <a
        href="/find-school"
        className="inline-flex items-center gap-1.5 self-center rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        {t("emailBack")}
      </a>
    </>
  )
}
