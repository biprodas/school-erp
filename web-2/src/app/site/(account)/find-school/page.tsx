import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  FindByAddressForm,
  FindByEmailForm,
} from "~/features/signup/find-school-forms"
import { publicEnv } from "~/lib/public-env"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("findSchool")
  return { title: t("metaTitle") }
}

/**
 * `/find-school` on the apex, where "Sign in" on the marketing site leads:
 * sign-in happens on each school's own address, so this finds it.
 */
export default async function FindSchoolPage() {
  const t = await getTranslations("findSchool")

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <Panel title={t("addressTitle")} description={t("addressDescription")}>
        <FindByAddressForm rootDomain={publicEnv.rootDomain} />
      </Panel>
      <Panel title={t("emailTitle")} description={t("emailDescription")}>
        <FindByEmailForm />
      </Panel>
      <p className="text-sm text-muted-foreground">
        {t("newSchool")}{" "}
        <a
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("signup")}
        </a>
      </p>
    </>
  )
}

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}
