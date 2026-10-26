"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CircleAlertIcon,
  ExternalLinkIcon,
  GlobeIcon,
  GlobeLockIcon,
  ImageUpIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState, type FormEvent } from "react"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button, buttonVariants } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { can } from "~/features/access/permissions"
import { usePermissions } from "~/features/access/use-permissions"
import {
  HOME_IMAGE_MAX_BYTES,
  HOME_PAGE_LIMITS,
  LOGO_TYPES,
  schoolSettingsQuery,
  settingsKeys,
  updateProfileSettings,
  uploadHomeImage,
  type HomeImage,
  type HomePageSettings,
  type SchoolSettings,
} from "~/features/settings/api"
import { isApiError, NETWORK_ERROR } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  inLang,
  isEnglishOnlyError,
  missingBangla,
  sectionId,
  toPatch,
  toValues,
  validate,
  type ContentLang,
  type Fact,
  type FlagKey,
  type HomeErrors,
  type HomeValues,
  type Highlight,
  type Region,
  type TextKey,
} from "../home-page-form"
import { HomePagePreview } from "./home-page-preview"

/**
 * `/dashboard/settings/home-page`: whether the school has a public home
 * page (`/` on its host; off, it goes to sign-in) and what it shows. The
 * form sits beside a live miniature of the page, whose parts lead to their
 * fields. Text is written one language at a time. Text and switches save
 * together; images upload as soon as they are picked. Members without
 * `settings:update` see it read-only.
 */
export function HomePageEditor() {
  const t = useTranslations("settings.homePage")
  const settings = useQuery(schoolSettingsQuery())

  if (settings.isPending) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <Skeleton className="hidden h-[32rem] rounded-xl lg:block" />
      </div>
    )
  }
  if (settings.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlertIcon />
        <AlertDescription className="flex flex-col items-start gap-2">
          {t("loadFailed")}
          <Button
            variant="outline"
            size="sm"
            onClick={() => settings.refetch()}
          >
            {t("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  // Keyed by the saved values, so a save (or another tab's) resets the form.
  return (
    <HomePageForm
      key={JSON.stringify(toValues(settings.data))}
      settings={settings.data}
    />
  )
}

function useErrorMessage() {
  const t = useTranslations("settings.homePage.errors")
  return (error: unknown) => {
    if (!isApiError(error)) return t("failed")
    if (error.code === NETWORK_ERROR) return t("network")
    if (error.status === 403) return t("forbidden")
    if (error.status === 400) return t("invalid")
    return t("failed")
  }
}

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

function HomePageForm({ settings }: { settings: SchoolSettings }) {
  const t = useTranslations("settings.homePage")
  const tv = (key: string) => t(key as Parameters<typeof t>[0])
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const editable = can(usePermissions(), "settings:update")
  const initial = toValues(settings)
  const [values, setValues] = useState<HomeValues>(initial)
  const [errors, setErrors] = useState<HomeErrors>({})
  const [lang, setLang] = useState<ContentLang>("en")
  const [active, setActive] = useState<Region | null>(null)
  const [pane, setPane] = useState<"edit" | "preview">("edit")
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const missing = missingBangla(values)
  // Rendered only in the browser (the settings query isn't prefetched).
  const host = window.location.host
  const { profile, organization, files } = settings

  const save = useMutation({
    mutationFn: updateProfileSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      toast.add({ title: t("saved"), type: "success", timeout: 4000 })
    },
    onError: (error) =>
      toast.add({ title: errorMessage(error), type: "error", timeout: 8000 }),
  })

  const setText = (key: TextKey) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }))
  const setFlag = (key: FlagKey) => (value: boolean) =>
    setValues((v) => ({ ...v, [key]: value }))
  const input = (key: TextKey) => ({
    id: `home-${key}`,
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setText(key)(e.target.value),
    ...(key.endsWith("Bn") ? { lang: "bn" } : {}),
    ...ariaFor(`home-${key}`, errors[key]),
  })

  /** From the preview: show the part's section and put the cursor in it. */
  function edit(region: Region) {
    setActive(region)
    setPane("edit")
    requestAnimationFrame(() => {
      const section = document.getElementById(sectionId(region))
      if (!section) return
      section.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      })
      section
        .querySelector<HTMLElement>(
          "input:not([type=file]):not(:disabled), textarea:not(:disabled), [role=switch]:not([data-disabled])"
        )
        ?.focus({ preventScroll: true })
    })
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { errors: next, facts, highlights } = validate(values, tv)
    setErrors(next)
    if (Object.keys(next).length) {
      // Required English fields aren't on screen while writing Bangla.
      if (lang === "bn" && Object.keys(next).some(isEnglishOnlyError)) {
        setLang("en")
      }
      setPane("edit")
      toast.add({ title: t("errors.check"), type: "error", timeout: 6000 })
      return
    }
    save.mutate(toPatch(values, facts, highlights))
  }

  const section = (region: Region) => ({
    region,
    active: active === region,
    onFocus: () => setActive(region),
  })

  const address = [
    profile.address.line1,
    profile.address.area,
    [profile.address.district, profile.address.postCode]
      .filter(Boolean)
      .join(" "),
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {!editable && (
        <Alert>
          <CircleAlertIcon />
          <AlertDescription>{t("readOnly")}</AlertDescription>
        </Alert>
      )}

      <StatusStrip
        enabled={values.enabled}
        host={host}
        editable={editable}
        onChange={setFlag("enabled")}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <LangChoice value={lang} onChange={setLang} />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {lang === "bn" ? (
              t("lang.fallback")
            ) : missing > 0 ? (
              <>
                {t("lang.missing", { count: missing })}{" "}
                <button
                  type="button"
                  onClick={() => setLang("bn")}
                  className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {t("lang.writeBangla")}
                </button>
              </>
            ) : null}
          </p>
        </div>
        <Pills
          label={t("pane.label")}
          className="lg:hidden"
          value={pane}
          onChange={setPane}
          options={[
            { value: "edit", label: t("pane.edit") },
            { value: "preview", label: t("pane.preview") },
          ]}
        />
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-14">
        <fieldset
          disabled={!editable}
          className={cn(
            "flex min-w-0 flex-col",
            pane === "preview" && "max-lg:hidden"
          )}
        >
          <Section
            {...section("hero")}
            title={t("hero.title")}
            hint={t("hero.hint")}
          >
            <ImageField
              image="hero"
              label={t("hero.image")}
              hint={t("hero.imageHint")}
              url={files?.homeHeroImageUrl ?? null}
              fileId={profile.homePage.heroImageFileId}
              editable={editable}
              className="aspect-[16/7] w-full max-w-md"
            />
            <FormField
              id={`home-${inLang("tagline", lang)}`}
              label={t("hero.tagline")}
            >
              <Input
                {...input(inLang("tagline", lang))}
                maxLength={160}
                placeholder={
                  lang === "bn"
                    ? values.tagline || undefined
                    : t("hero.taglinePlaceholder")
                }
              />
            </FormField>
            <FormField
              id="home-establishedYear"
              label={t("hero.established")}
              error={errors.establishedYear}
            >
              <Input
                {...input("establishedYear")}
                inputMode="numeric"
                maxLength={4}
                placeholder={t("hero.establishedPlaceholder")}
                className="max-w-32"
              />
            </FormField>
          </Section>

          <Section
            {...section("facts")}
            title={t("facts.title")}
            hint={t("facts.hint")}
          >
            <ListEditor
              rows={values.facts}
              max={HOME_PAGE_LIMITS.facts}
              addLabel={t("facts.add")}
              removeLabel={(n) => t("facts.remove", { n })}
              empty={t("facts.empty")}
              onAdd={() =>
                setValues((v) => ({
                  ...v,
                  facts: [...v.facts, { value: "", label: "", labelBn: "" }],
                }))
              }
              onRemove={(i) =>
                setValues((v) => ({
                  ...v,
                  facts: v.facts.filter((_, j) => j !== i),
                }))
              }
              render={(fact, i) => {
                const set =
                  (key: keyof Fact) => (e: { target: { value: string } }) =>
                    setValues((v) => ({
                      ...v,
                      facts: v.facts.map((f, j) =>
                        j === i ? { ...f, [key]: e.target.value } : f
                      ),
                    }))
                const labelKey = lang === "bn" ? "labelBn" : "label"
                const id = (key: string) => `home-fact-${i}-${key}`
                const valueError = errors[`fact-${i}-value`]
                const labelError =
                  lang === "en" ? errors[`fact-${i}-label`] : undefined
                return (
                  <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <FormField
                      id={id("value")}
                      label={t("facts.value")}
                      error={valueError}
                    >
                      <Input
                        id={id("value")}
                        value={fact.value}
                        onChange={set("value")}
                        maxLength={20}
                        placeholder={t("facts.valuePlaceholder")}
                        {...ariaFor(id("value"), valueError)}
                      />
                    </FormField>
                    <FormField
                      id={id(labelKey)}
                      label={t("facts.label")}
                      error={labelError}
                    >
                      <Input
                        id={id(labelKey)}
                        value={fact[labelKey]}
                        onChange={set(labelKey)}
                        lang={lang === "bn" ? "bn" : undefined}
                        maxLength={60}
                        placeholder={
                          lang === "bn"
                            ? fact.label || undefined
                            : t("facts.labelPlaceholder")
                        }
                        {...ariaFor(id(labelKey), labelError)}
                      />
                    </FormField>
                  </div>
                )
              }}
            />
          </Section>

          <Section
            {...section("about")}
            title={t("about.title")}
            hint={t("about.hint")}
          >
            <FormField
              id={`home-${inLang("about", lang)}`}
              label={t("about.about")}
            >
              <Textarea
                {...input(inLang("about", lang))}
                rows={5}
                maxLength={2000}
                placeholder={
                  lang === "bn" ? values.about || undefined : undefined
                }
              />
            </FormField>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium">{t("highlights.title")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("highlights.hint")}
                </p>
              </div>
              <ListEditor
                rows={values.highlights}
                max={HOME_PAGE_LIMITS.highlights}
                addLabel={t("highlights.add")}
                removeLabel={(n) => t("highlights.remove", { n })}
                empty={t("highlights.empty")}
                onAdd={() =>
                  setValues((v) => ({
                    ...v,
                    highlights: [
                      ...v.highlights,
                      { title: "", titleBn: "", body: "", bodyBn: "" },
                    ],
                  }))
                }
                onRemove={(i) =>
                  setValues((v) => ({
                    ...v,
                    highlights: v.highlights.filter((_, j) => j !== i),
                  }))
                }
                render={(item, i) => {
                  const set =
                    (key: keyof Highlight) =>
                    (e: { target: { value: string } }) =>
                      setValues((v) => ({
                        ...v,
                        highlights: v.highlights.map((h, j) =>
                          j === i ? { ...h, [key]: e.target.value } : h
                        ),
                      }))
                  const titleKey = lang === "bn" ? "titleBn" : "title"
                  const bodyKey = lang === "bn" ? "bodyBn" : "body"
                  const id = (key: string) => `home-highlight-${i}-${key}`
                  const error =
                    lang === "en" ? errors[`highlight-${i}-title`] : undefined
                  return (
                    <div className="flex flex-col gap-3">
                      <FormField
                        id={id(titleKey)}
                        label={t("highlights.itemTitle")}
                        error={error}
                      >
                        <Input
                          id={id(titleKey)}
                          value={item[titleKey]}
                          onChange={set(titleKey)}
                          lang={lang === "bn" ? "bn" : undefined}
                          maxLength={80}
                          placeholder={
                            lang === "bn"
                              ? item.title || undefined
                              : t("highlights.titlePlaceholder")
                          }
                          {...ariaFor(id(titleKey), error)}
                        />
                      </FormField>
                      <FormField id={id(bodyKey)} label={t("highlights.body")}>
                        <Textarea
                          id={id(bodyKey)}
                          value={item[bodyKey]}
                          onChange={set(bodyKey)}
                          lang={lang === "bn" ? "bn" : undefined}
                          rows={2}
                          maxLength={400}
                          placeholder={
                            lang === "bn" ? item.body || undefined : undefined
                          }
                        />
                      </FormField>
                    </div>
                  )
                }}
              />
            </div>
          </Section>

          <Section
            {...section("principal")}
            title={t("principal.title")}
            hint={t("principal.hint")}
          >
            <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
              <ImageField
                image="principal"
                label={t("principal.photo")}
                hint={t("principal.photoHint")}
                url={files?.homePrincipalPhotoUrl ?? null}
                fileId={profile.homePage.principalPhotoFileId}
                editable={editable}
                className="aspect-4/5 w-32"
              />
              <div className="flex flex-col gap-4">
                <FormField id="home-principalName" label={t("principal.name")}>
                  <Input
                    {...input("principalName")}
                    maxLength={100}
                    autoComplete="off"
                  />
                </FormField>
                <FormField
                  id={`home-${inLang("principalMessage", lang)}`}
                  label={t("principal.message")}
                >
                  <Textarea
                    {...input(inLang("principalMessage", lang))}
                    rows={6}
                    maxLength={3000}
                    placeholder={
                      lang === "bn"
                        ? values.principalMessage || undefined
                        : undefined
                    }
                  />
                </FormField>
              </div>
            </div>
          </Section>

          <Section
            {...section("admission")}
            title={t("admission.title")}
            hint={t("admission.hint")}
          >
            <Toggle
              id="home-admissionOpen"
              label={t("admission.open")}
              checked={values.admissionOpen}
              onChange={setFlag("admissionOpen")}
              disabled={!editable}
            >
              {values.admissionOpen && (
                <FormField
                  id={`home-${inLang("admissionNote", lang)}`}
                  label={t("admission.note")}
                >
                  <Input
                    {...input(inLang("admissionNote", lang))}
                    maxLength={300}
                    placeholder={
                      lang === "bn"
                        ? values.admissionNote || undefined
                        : t("admission.notePlaceholder")
                    }
                  />
                </FormField>
              )}
            </Toggle>
          </Section>

          <Section
            {...section("more")}
            title={t("sections.title")}
            hint={t("sections.hint")}
          >
            <Toggle
              id="home-showNotices"
              label={t("sections.notices")}
              description={t("sections.noticesHint")}
              checked={values.showNotices}
              onChange={setFlag("showNotices")}
              disabled={!editable}
            >
              {values.showNotices && (
                <FormField
                  id="home-noticeLimit"
                  label={t("sections.noticeLimit")}
                  error={errors.noticeLimit}
                >
                  <Input
                    {...input("noticeLimit")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={HOME_PAGE_LIMITS.noticeLimit}
                    className="max-w-24"
                  />
                </FormField>
              )}
            </Toggle>
            <Toggle
              id="home-showContact"
              label={t("sections.contact")}
              description={t("sections.contactHint")}
              checked={values.showContact}
              onChange={setFlag("showContact")}
              disabled={!editable}
            />
            <Toggle
              id="home-showAddress"
              label={t("sections.address")}
              checked={values.showAddress}
              onChange={setFlag("showAddress")}
              disabled={!editable}
            />
          </Section>
        </fieldset>

        <aside
          aria-label={t("preview.title")}
          className={cn(
            "lg:sticky lg:top-20",
            pane === "edit" && "max-lg:hidden"
          )}
        >
          <HomePagePreview
            values={values}
            lang={lang}
            host={host}
            active={active}
            onEdit={edit}
            school={{
              name: organization.name,
              nameBn: profile.nameBn ?? "",
              logoUrl: files?.logoUrl ?? null,
              heroUrl: files?.homeHeroImageUrl ?? null,
              photoUrl: files?.homePrincipalPhotoUrl ?? null,
              phone: profile.phone,
              email: profile.email,
              address: address || null,
            }}
          />
        </aside>
      </div>

      {/* Stays in reach on long forms; says when there is something to save. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              dirty ? "bg-highlight" : "bg-primary/40"
            )}
          />
          {dirty ? t("unsaved") : t("upToDate")}
        </p>
        <div className="flex gap-2">
          {/* Off, `/` goes to sign-in: nothing to view. */}
          {profile.homePage.enabled && (
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "max-sm:flex-1"
              )}
            >
              <ExternalLinkIcon aria-hidden />
              {t("view")}
            </a>
          )}
          {editable && (
            <Button
              type="submit"
              disabled={save.isPending || !dirty}
              className="max-sm:flex-1"
              aria-busy={save.isPending || undefined}
            >
              {save.isPending && <Spinner />}
              {t("save")}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

/** Whether the page is up, at which address; the switch that decides it. */
function StatusStrip({
  enabled,
  host,
  editable,
  onChange,
}: {
  enabled: boolean
  host: string
  editable: boolean
  onChange: (enabled: boolean) => void
}) {
  const t = useTranslations("settings.homePage")
  const Icon = enabled ? GlobeIcon : GlobeLockIcon
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-colors",
        enabled ? "border-primary/25 bg-primary/[0.05]" : "bg-muted/60"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full max-sm:hidden",
          enabled
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium">
          {enabled ? t("status.on") : t("status.off")}
        </p>
        <p className="text-sm text-pretty text-muted-foreground">
          {t.rich(enabled ? "status.onHint" : "status.offHint", {
            host: () => (
              <span className="font-medium break-all text-foreground">
                {host}
              </span>
            ),
          })}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={!editable}
        aria-label={t("visibility.enabled")}
      />
    </div>
  )
}

/** Which language's text the form shows. */
function LangChoice({
  value,
  onChange,
}: {
  value: ContentLang
  onChange: (lang: ContentLang) => void
}) {
  const t = useTranslations("settings.homePage")
  const tl = useTranslations("common.languages")
  return (
    <Pills
      label={t("lang.label")}
      showLabel
      value={value}
      onChange={onChange}
      options={[
        { value: "en", label: tl("en") },
        { value: "bn", label: tl("bn"), lang: "bn" },
      ]}
    />
  )
}

/** A small segmented choice (radio buttons drawn as joined pills). */
function Pills<V extends string>({
  label,
  showLabel = false,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  showLabel?: boolean
  value: V
  onChange: (value: V) => void
  options: { value: V; label: string; lang?: string }[]
  className?: string
}) {
  const name = useId()
  return (
    <div
      role="radiogroup"
      aria-label={showLabel ? undefined : label}
      aria-labelledby={showLabel ? `${name}-label` : undefined}
      className={cn("flex items-center gap-2", className)}
    >
      {showLabel && (
        <span id={`${name}-label`} className="text-sm text-muted-foreground">
          {label}
        </span>
      )}
      <span className="inline-flex rounded-full border bg-card p-0.5">
        {options.map((option) => {
          const chosen = option.value === value
          return (
            <label
              key={option.value}
              lang={option.lang}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/40",
                chosen
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={chosen}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </span>
    </div>
  )
}

/**
 * A part of the page in the form. The one being edited carries the amber
 * rule that matches the preview's "Editing" tag.
 */
function Section({
  region,
  active,
  onFocus,
  title,
  hint,
  children,
}: {
  region: Region
  active: boolean
  onFocus: () => void
  title: string
  hint: string
  children: React.ReactNode
}) {
  const id = sectionId(region)
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      onFocusCapture={onFocus}
      className="group/section relative scroll-mt-20 border-t py-8 first:border-t-0 first:pt-0"
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-8 bottom-8 -left-3 w-0.5 rounded-full bg-highlight transition-opacity group-first/section:top-0 sm:-left-4",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="mb-5 flex flex-col gap-0.5">
        <h2 id={`${id}-title`} className="font-display text-xl font-semibold">
          {title}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
  children,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
  /** Settings that only apply while it is on, shown under it. */
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
          {description && (
            <p id={`${id}-hint`} className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-describedby={description ? `${id}-hint` : undefined}
          className="mt-0.5"
        />
      </div>
      {children}
    </div>
  )
}

/** Rows of a short list, each removable, with "Add" up to `max`. */
function ListEditor<Row>({
  rows,
  max,
  addLabel,
  removeLabel,
  empty,
  onAdd,
  onRemove,
  render,
}: {
  rows: Row[]
  max: number
  addLabel: string
  removeLabel: (n: number) => string
  empty: string
  onAdd: () => void
  onRemove: (index: number) => void
  render: (row: Row, index: number) => React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg border bg-card p-4"
        >
          <div className="min-w-0 flex-1">{render(row, i)}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={removeLabel(i + 1)}
            title={removeLabel(i + 1)}
            onClick={() => onRemove(i)}
            className="mt-6 text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      {rows.length < max && (
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="self-start"
        >
          <PlusIcon aria-hidden />
          {addLabel}
        </Button>
      )}
    </div>
  )
}

/**
 * An image of the page: a preview (or an empty frame that picks a file),
 * "Replace" which saves at once, and "Remove" which clears it.
 */
function ImageField({
  image,
  label,
  hint,
  url,
  fileId,
  editable,
  className,
}: {
  image: HomeImage
  label: string
  hint: string
  url: string | null
  fileId: string | null
  editable: boolean
  className?: string
}) {
  const t = useTranslations("settings.homePage.image")
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const picker = useRef<HTMLInputElement>(null)
  const field = image === "hero" ? "heroImageFileId" : "principalPhotoFileId"

  const done = (title: string) => async () => {
    await queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    toast.add({ title, type: "success", timeout: 4000 })
  }
  const onError = (error: unknown) =>
    toast.add({ title: errorMessage(error), type: "error", timeout: 8000 })
  const upload = useMutation({
    mutationFn: (file: File) => uploadHomeImage(image, file),
    onSuccess: done(t("saved")),
    onError,
  })
  const remove = useMutation({
    mutationFn: () =>
      updateProfileSettings({
        homePage: { [field]: null } as Partial<HomePageSettings>,
      }),
    onSuccess: done(t("removed")),
    onError,
  })
  const pending = upload.isPending || remove.isPending

  function onPick(file: File | undefined) {
    if (!file) return
    if (!LOGO_TYPES.includes(file.type) || file.size > HOME_IMAGE_MAX_BYTES) {
      toast.add({ title: t("invalid"), type: "error", timeout: 8000 })
      return
    }
    upload.mutate(file)
  }

  const frame = cn(
    "relative flex items-center justify-center overflow-hidden rounded-lg border bg-muted/40",
    !url && "border-dashed",
    className
  )
  const content = (
    <>
      {url ? (
        // Signed storage URL, short-lived: nothing for an image optimizer to cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="size-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
          <ImageUpIcon aria-hidden className="size-5" />
          {editable && t("upload")}
        </span>
      )}
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center bg-card/70">
          <Spinner />
        </span>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {/* The empty frame is itself the way to pick a file. */}
      {!url && editable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => picker.current?.click()}
          aria-label={t("uploadLabel", { image: label })}
          className={cn(
            frame,
            "transition-colors outline-none hover:border-primary hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
        >
          {content}
        </button>
      ) : (
        <div className={frame}>{content}</div>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={picker}
            type="file"
            accept={LOGO_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              onPick(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          {url && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => picker.current?.click()}
            >
              {t("replace")}
            </Button>
          )}
          {fileId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => remove.mutate()}
            >
              {t("remove")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
