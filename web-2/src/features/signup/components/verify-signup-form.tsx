"use client"

import {
  BadgeCheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  GlobeIcon,
  InfoIcon,
  SchoolIcon,
  UserRoundIcon,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useActionState, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { ariaFor, FormField } from "~/components/forms/form-field"
import { SubmitButton } from "~/components/forms/submit-button"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { FieldDescription } from "~/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { FormAlert } from "~/features/auth/components/form-alert"
import { IDLE } from "~/lib/forms/form-state"

import { verifySignup } from "../actions"
import type { SignupPreview } from "../api"
import { SlugStatus } from "./slug-status"

const SLUG_MESSAGES = {
  taken: "slugTaken",
  reserved: "slugReserved",
  invalid: "slugInvalid",
} as const

/**
 * Creates the school from the emailed link: what will be made (school,
 * address, owner) to check first, then one press (creating it on page
 * load would let mail scanners, which open links, use it up). The
 * address can still be changed here; when it was taken since signing up,
 * its field is open with alternatives and another must be picked.
 */
export function VerifySignupForm({
  token,
  preview,
  rootDomain,
}: {
  token: string
  preview: SignupPreview
  rootDomain: string
}) {
  const t = useTranslations("signup")
  const tv = useTranslations("validation")
  const format = useFormatter()
  const [state, formAction, pending] = useActionState(verifySignup, IDLE)
  const [slug, setSlug] = useState(preview.slug)
  const [slugOpen, setSlugOpen] = useState(false)
  /** The address the last press sent, which its error is about. */
  const [sentSlug, setSentSlug] = useState(preview.slug)
  const changeRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { available, reason } = preview.slugCheck
  const actionError =
    state.status === "error" && slug === sentSlug
      ? state.fieldErrors?.slug
      : undefined
  const previewError =
    !available && slug === preview.slug
      ? SLUG_MESSAGES[reason ?? "taken"]
      : undefined
  const slugMessage = actionError ?? previewError
  const slugError = slugMessage ? tv(slugMessage) : undefined
  const suggestions =
    actionError && state.status === "error"
      ? state.suggestions
      : previewError
        ? preview.slugCheck.suggestions
        : undefined

  // A problem with the address keeps its field open.
  const expanded = slugOpen || !!slugMessage
  const changed = slug.trim() !== "" && slug !== preview.slug
  const blocked = !!slugMessage || slug.trim() === ""

  function openSlug() {
    flushSync(() => setSlugOpen(true))
    inputRef.current?.focus()
  }

  function closeSlug() {
    // An emptied field goes back to the address asked for.
    if (slug.trim() === "") setSlug(preview.slug)
    flushSync(() => setSlugOpen(false))
    changeRef.current?.focus()
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setSentSlug(slug)}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="token" value={token} />
      {changed && <input type="hidden" name="slug" value={slug} />}

      <FormAlert state={state.status === "error" ? state : undefined} />

      <dl className="divide-y rounded-lg border">
        <SummaryRow icon={SchoolIcon} label={t("verify.school")}>
          <span className="font-medium break-words">{preview.schoolName}</span>
        </SummaryRow>

        <SummaryRow
          icon={GlobeIcon}
          label={t("slugLabel")}
          action={
            !expanded && (
              <Button
                ref={changeRef}
                type="button"
                variant="link"
                className="h-auto p-0"
                aria-controls="slug-field"
                aria-expanded={false}
                onClick={openSlug}
              >
                {t("changeSlug")}
              </Button>
            )
          }
        >
          <div hidden={expanded} className="flex flex-col gap-1">
            <span className="font-medium break-all">
              {slug}.{rootDomain}
            </span>
            {slug === preview.slug && available && (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CircleCheckIcon className="size-4" aria-hidden="true" />
                {t("verify.slugReady")}
              </span>
            )}
          </div>
          <div id="slug-field" hidden={!expanded} className="pt-1">
            {previewError && (
              <p className="mb-3 flex items-start gap-1.5 text-sm text-destructive">
                <CircleXIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {t("verify.slugGone", {
                  host: `${preview.slug}.${rootDomain}`,
                })}
              </p>
            )}
            <FormField
              id="slug"
              label={t("newSlugLabel")}
              error={slugError}
              action={
                !slugMessage && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto shrink-0 p-0"
                    aria-controls="slug-field"
                    aria-expanded={true}
                    onClick={closeSlug}
                  >
                    {t("slugDone")}
                  </Button>
                )
              }
            >
              <InputGroup>
                <InputGroupInput
                  ref={inputRef}
                  id="slug"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("slugPlaceholder")}
                  value={slug}
                  onChange={(event) =>
                    setSlug(event.target.value.toLowerCase())
                  }
                  {...ariaFor("slug", slugError)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>.{rootDomain}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {!slugError && (
                <FieldDescription>{t("slugHint")}</FieldDescription>
              )}
            </FormField>
            <div className="mt-2">
              <SlugStatus
                slug={slug === preview.slug ? "" : slug}
                rootDomain={rootDomain}
                suggestions={suggestions}
                onPick={setSlug}
              />
            </div>
          </div>
        </SummaryRow>

        <SummaryRow icon={UserRoundIcon} label={t("verify.owner")}>
          <span className="font-medium break-words">{preview.ownerName}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span className="break-all">{preview.email}</span>
            <span className="inline-flex items-center gap-1 text-primary">
              <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
              {t("verify.verified")}
            </span>
          </span>
          <span className="text-sm text-muted-foreground">
            {t("verify.ownerRole")}
          </span>
        </SummaryRow>
      </dl>

      {preview.existingAccount && (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            {t("verify.existingAccount", { email: preview.email })}
          </AlertDescription>
        </Alert>
      )}

      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {(["trial", "noCard", "signedIn", "setupLater"] as const).map((key) => (
          <li key={key} className="flex items-center gap-2">
            <CircleCheckIcon
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            {t(`verify.perks.${key}`)}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <SubmitButton pending={pending} disabled={blocked}>
          {t("createSchool")}
        </SubmitButton>
        <p className="text-center text-sm text-balance text-muted-foreground">
          {t.rich("verify.footer", {
            until: format.dateTime(new Date(preview.expiresAt), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            again: (chunks) => (
              <a
                href={`/signup?schoolName=${encodeURIComponent(preview.schoolName)}`}
                className="rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </form>
  )
}

/** One line of the summary: an icon, what it is, the value, and maybe "Change". */
function SummaryRow({
  icon: Icon,
  label,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 p-4">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          {action}
        </div>
        <dd className="flex flex-col gap-0.5">{children}</dd>
      </div>
    </div>
  )
}
