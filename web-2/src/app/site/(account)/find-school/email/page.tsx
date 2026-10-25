import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

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
      <div className="flex flex-col gap-6 rounded-xl border p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold">
            {t("emailPageTitle")}
          </h1>
          <p className="text-muted-foreground">{t("emailDescription")}</p>
        </div>
        <FindByEmailForm />
      </div>
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
