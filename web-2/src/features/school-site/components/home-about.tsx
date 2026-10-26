import { CheckIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { HomeContainer, HomeHeading, HomeSection } from "./home-section"

/** The school's numbers in a card that overlaps the hero's bottom edge. */
export async function HomeFacts({
  facts,
}: {
  facts: { value: string; label: string }[]
}) {
  const t = await getTranslations("schoolHome")

  return (
    <HomeContainer className="relative z-10 -mt-10 sm:-mt-12">
      <h2 className="sr-only">{t("facts")}</h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-sm md:auto-cols-fr md:grid-flow-col md:grid-cols-none">
        {facts.map((fact, i) => (
          <div
            key={i}
            className="flex flex-col-reverse gap-1 bg-card p-5 last:odd:col-span-2 sm:p-6 md:last:odd:col-span-1"
          >
            <dt className="text-sm text-muted-foreground">{fact.label}</dt>
            <dd className="font-display text-3xl font-semibold text-primary sm:text-4xl">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </HomeContainer>
  )
}

/** About the school, and what sets it apart. */
export async function HomeAbout({
  about,
  highlights,
}: {
  about: string | null
  highlights: { title: string; body: string | null }[]
}) {
  const t = await getTranslations("schoolHome")

  return (
    <HomeSection id="about">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col gap-5">
          <HomeHeading id="about">{t("about")}</HomeHeading>
          {about && (
            <p className="text-lg leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
              {about}
            </p>
          )}
        </div>
        {highlights.length > 0 && (
          <div className="flex flex-col gap-5">
            <h3 className="text-sm font-semibold tracking-wide text-primary uppercase lg:mt-5">
              {t("highlights")}
            </h3>
            <ul className="grid gap-4 sm:grid-cols-2">
              {highlights.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border bg-card p-5"
                >
                  <span
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-hidden="true"
                  >
                    <CheckIcon className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-medium">{item.title}</p>
                    {item.body && (
                      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                        {item.body}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </HomeSection>
  )
}
