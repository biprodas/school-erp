"use client"

import { CheckIcon, LockIcon, QuoteIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"

import { SchoolLogo } from "~/components/common/school-logo"
import { initials } from "~/lib/initials"
import { toBanglaDigits } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  pick,
  type ContentLang,
  type HomeValues,
  type Region,
} from "../home-page-form"

export interface PreviewSchool {
  name: string
  nameBn: string
  logoUrl: string | null
  heroUrl: string | null
  photoUrl: string | null
  phone: string | null
  email: string | null
  address: string | null
}

/**
 * The school's home page in miniature, drawn from the form as it is typed
 * (in the language being written), in the school's own color. Each part is
 * a button to its fields; the part being edited carries an "Editing" tag.
 * Parts the school hasn't filled in show what goes there. When the page is
 * off, a note says visitors get the sign-in page instead.
 */
export function HomePagePreview({
  values: v,
  lang,
  school,
  host,
  active,
  onEdit,
}: {
  values: HomeValues
  lang: ContentLang
  school: PreviewSchool
  host: string
  active: Region | null
  onEdit: (region: Region) => void
}) {
  const t = useTranslations("settings.homePage.preview")
  const th = useTranslations("schoolHome")
  const page = useRef<HTMLDivElement>(null)

  // Keep the part being edited in view inside the preview's own scroll.
  useEffect(() => {
    if (!active) return
    page.current
      ?.querySelector(`[data-region="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  const name = pick(lang, school.name, school.nameBn)
  const digits = (s: string) => (lang === "bn" ? toBanglaDigits(s) : s)
  const tagline = pick(lang, v.tagline, v.taglineBn)
  const about = pick(lang, v.about, v.aboutBn)
  const message = pick(lang, v.principalMessage, v.principalMessageBn)
  const note = pick(lang, v.admissionNote, v.admissionNoteBn)
  const year = /^\d{4}$/.test(v.establishedYear.trim())
    ? digits(v.establishedYear.trim())
    : null
  const facts = v.facts.filter((f) => f.value.trim() || f.label.trim())
  const highlights = v.highlights.filter((h) => pick(lang, h.title, h.titleBn))

  const region = (id: Region, label: string) => ({
    region: id,
    active: active === id,
    label: t("edit", { part: label }),
    editing: t("editing"),
    onClick: () => onEdit(id),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_0_var(--border),0_12px_32px_-16px_oklch(0.3_0.04_165/0.25)]">
        <div className="flex h-9 items-center gap-2 border-b bg-muted/60 px-3 text-xs text-muted-foreground">
          <LockIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{host}</span>
        </div>
        <div
          ref={page}
          className="relative max-h-[calc(100svh-15rem)] min-h-80 overflow-y-auto bg-background text-[11px] leading-snug"
        >
          {!v.enabled && (
            <div className="sticky top-0 z-20 flex items-center justify-center bg-foreground/85 px-4 py-2.5 text-center text-xs font-medium text-background">
              {t("off")}
            </div>
          )}
          <div className={cn(!v.enabled && "opacity-45 grayscale")}>
            {v.admissionOpen && (
              <Part {...region("admission", t("parts.admission"))}>
                <span className="flex gap-1.5 bg-primary px-3 py-1.5 text-[10px] text-primary-foreground">
                  <strong className="shrink-0 font-semibold">
                    {th("admissionOpen")}
                  </strong>
                  {note && <span className="truncate opacity-90">{note}</span>}
                </span>
              </Part>
            )}

            <span className="flex h-8 items-center gap-1.5 border-b px-3">
              <SchoolLogo
                name={name || "?"}
                logoUrl={school.logoUrl}
                alt=""
                className="size-5 shrink-0 text-[8px]"
              />
              <span className="mr-auto truncate font-display text-xs font-semibold">
                {name}
              </span>
              <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">
                {th("signIn")}
              </span>
            </span>

            <Part {...region("hero", t("parts.hero"))}>
              <span
                className={cn(
                  "relative isolate flex flex-col gap-1.5 overflow-hidden px-4 pt-5 pb-7",
                  school.heroUrl ? "text-white" : "bg-primary/[0.07]"
                )}
              >
                {school.heroUrl && (
                  <>
                    {/* Signed storage URL, short-lived. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={school.heroUrl}
                      alt=""
                      className="absolute inset-0 -z-20 size-full object-cover"
                    />
                    <span className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/55 to-black/25" />
                  </>
                )}
                <SchoolLogo
                  name={name || "?"}
                  logoUrl={school.logoUrl}
                  alt=""
                  className="mb-1 size-9 text-xs [&_[data-slot=avatar-fallback]]:bg-primary [&_[data-slot=avatar-fallback]]:text-primary-foreground"
                />
                {year && (
                  <span
                    className={cn(
                      "text-[9px] font-semibold tracking-wide uppercase",
                      school.heroUrl ? "text-white/80" : "text-primary"
                    )}
                  >
                    {th("established", { year })}
                  </span>
                )}
                <span className="font-display text-lg leading-tight font-semibold text-balance">
                  {name}
                </span>
                {tagline ? (
                  <span
                    className={cn(
                      "line-clamp-2",
                      school.heroUrl ? "text-white/85" : "text-muted-foreground"
                    )}
                  >
                    {tagline}
                  </span>
                ) : (
                  <Slot>{t("slots.tagline")}</Slot>
                )}
              </span>
            </Part>

            <Part {...region("facts", t("parts.facts"))} className="-mt-3 px-3">
              {facts.length > 0 ? (
                <span
                  className="grid gap-px overflow-hidden rounded-md border bg-border"
                  style={{
                    gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))`,
                  }}
                >
                  {facts.map((fact, i) => (
                    <span key={i} className="flex flex-col bg-card px-2 py-1.5">
                      <span className="truncate font-display text-sm font-semibold text-primary">
                        {fact.value || "…"}
                      </span>
                      <span className="truncate text-[9px] text-muted-foreground">
                        {pick(lang, fact.label, fact.labelBn) || "…"}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="flex rounded-md border border-dashed bg-card px-2 py-2.5">
                  <Slot>{t("slots.facts")}</Slot>
                </span>
              )}
            </Part>

            <Part
              {...region("about", t("parts.about"))}
              className="flex flex-col gap-2 px-4 py-4"
            >
              <Heading>{th("about")}</Heading>
              {about ? (
                <span className="line-clamp-4 text-muted-foreground">
                  {about}
                </span>
              ) : (
                <Slot>{t("slots.about")}</Slot>
              )}
              {highlights.length > 0 && (
                <span className="grid grid-cols-2 gap-1.5">
                  {highlights.map((item, i) => (
                    <span
                      key={i}
                      className="flex items-start gap-1 rounded-sm border bg-card p-1.5"
                    >
                      <CheckIcon
                        aria-hidden
                        className="mt-px size-2.5 shrink-0 text-primary"
                      />
                      <span className="line-clamp-2 text-[10px] font-medium">
                        {pick(lang, item.title, item.titleBn)}
                      </span>
                    </span>
                  ))}
                </span>
              )}
            </Part>

            <Part
              {...region("principal", t("parts.principal"))}
              className="border-y bg-muted/40 px-4 py-4"
            >
              {message ? (
                <span className="flex gap-3">
                  {school.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={school.photoUrl}
                      alt=""
                      className="aspect-4/5 w-12 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      data-initials={
                        v.principalName.trim()
                          ? initials(v.principalName.trim())
                          : ""
                      }
                      className="flex aspect-4/5 w-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 font-display text-sm text-primary before:content-[attr(data-initials)]"
                    />
                  )}
                  <span className="flex min-w-0 flex-col gap-1">
                    <Heading>{th("principalMessage")}</Heading>
                    <span className="flex gap-1">
                      <QuoteIcon
                        aria-hidden
                        className="size-3 shrink-0 text-primary/30"
                      />
                      <span className="line-clamp-3">{message}</span>
                    </span>
                    {v.principalName.trim() && (
                      <span className="text-[10px] font-semibold">
                        {v.principalName.trim()}
                      </span>
                    )}
                  </span>
                </span>
              ) : (
                <Slot>{t("slots.principal")}</Slot>
              )}
            </Part>

            <Part
              {...region("more", t("parts.more"))}
              className="flex flex-col gap-3 px-4 py-4"
            >
              {v.showNotices && (
                <span className="flex flex-col gap-1.5">
                  <Heading>{th("notices")}</Heading>
                  <span className="flex flex-col gap-1 rounded-sm border bg-card p-2">
                    <span className="h-1.5 w-1/4 rounded-full bg-primary/40" />
                    <span className="h-1.5 w-3/4 rounded-full bg-muted" />
                    <span className="h-1.5 w-2/3 rounded-full bg-muted" />
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {t("noticesNote")}
                  </span>
                </span>
              )}
              {((v.showContact && (school.phone || school.email)) ||
                (v.showAddress && school.address)) && (
                <span className="flex flex-col gap-1">
                  <Heading>{th("contact")}</Heading>
                  {v.showContact &&
                    [school.phone, school.email].filter(Boolean).map((line) => (
                      <span key={line} className="truncate">
                        {line}
                      </span>
                    ))}
                  {v.showAddress && school.address && (
                    <span className="truncate text-muted-foreground">
                      {school.address}
                    </span>
                  )}
                </span>
              )}
              {!v.showNotices &&
                !(v.showContact && (school.phone || school.email)) &&
                !(v.showAddress && school.address) && (
                  <Slot>{t("slots.more")}</Slot>
                )}
            </Part>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A part of the page: a button to its fields. Hover outlines it; the part
 * being edited gets the amber outline and tag.
 */
function Part({
  region,
  active,
  label,
  editing,
  onClick,
  className,
  children,
}: {
  region: Region
  active: boolean
  label: string
  editing: string
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-region={region}
      aria-current={active || undefined}
      onClick={onClick}
      className={cn(
        "relative block w-full text-left outline-2 -outline-offset-2 outline-transparent transition-[outline-color] hover:outline-primary/40 hover:outline-dashed focus-visible:outline-ring focus-visible:outline-solid",
        active &&
          "outline-highlight outline-solid hover:outline-highlight hover:outline-solid",
        className
      )}
    >
      {/* Leads the name, which still includes the visible text (WCAG 2.5.3). */}
      <span className="sr-only">{label}</span>
      {children}
      {active && (
        <span
          aria-hidden
          className="absolute top-0 right-2 z-10 rounded-b-sm bg-highlight px-1.5 py-0.5 text-[9px] font-semibold text-highlight-foreground"
        >
          {editing}
        </span>
      )}
    </button>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-display text-xs font-semibold before:mb-1 before:block before:h-0.5 before:w-4 before:rounded-full before:bg-primary">
      {children}
    </span>
  )
}

/** A part the school hasn't written yet: says what goes there. */
function Slot({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-start border-b border-dashed border-current/50 text-[10px] opacity-70">
      {children}
    </span>
  )
}
