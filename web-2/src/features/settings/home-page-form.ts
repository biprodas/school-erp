import {
  HOME_PAGE_LIMITS,
  type ProfilePatch,
  type SchoolSettings,
} from "~/features/settings/api"

export type Fact = { value: string; label: string; labelBn: string }
export type Highlight = {
  title: string
  titleBn: string
  body: string
  bodyBn: string
}

/** The home page editor's values: text as typed (trimmed on save). */
export interface HomeValues {
  enabled: boolean
  tagline: string
  taglineBn: string
  establishedYear: string
  about: string
  aboutBn: string
  facts: Fact[]
  highlights: Highlight[]
  principalName: string
  principalMessage: string
  principalMessageBn: string
  admissionOpen: boolean
  admissionNote: string
  admissionNoteBn: string
  showContact: boolean
  showAddress: boolean
  showNotices: boolean
  noticeLimit: string
}

export type TextKey = {
  [K in keyof HomeValues]: HomeValues[K] extends string ? K : never
}[keyof HomeValues]
export type FlagKey = {
  [K in keyof HomeValues]: HomeValues[K] extends boolean ? K : never
}[keyof HomeValues]

/** The language the school is writing in; the page falls back to English. */
export type ContentLang = "en" | "bn"

/** Texts written in both languages: the English key and its Bangla twin. */
const TWINS = {
  tagline: "taglineBn",
  about: "aboutBn",
  principalMessage: "principalMessageBn",
  admissionNote: "admissionNoteBn",
} as const satisfies Partial<Record<TextKey, TextKey>>

export type TwinKey = keyof typeof TWINS

/** The field holding `key` in `lang`. */
export const inLang = (key: TwinKey, lang: ContentLang): TextKey =>
  lang === "bn" ? TWINS[key] : key

/**
 * The parts of the page, in page order. Each has a section in the form and
 * a region in the preview.
 */
export const REGIONS = [
  "admission",
  "hero",
  "facts",
  "about",
  "principal",
  "more",
] as const
export type Region = (typeof REGIONS)[number]

export const sectionId = (region: Region) => `home-section-${region}`

const text = (value: string | null | undefined) => value ?? ""
const orNull = (value: string) => value.trim() || null
const filled = (value: string) => value.trim().length > 0

export function toValues({ profile }: SchoolSettings): HomeValues {
  const page = profile.homePage
  return {
    enabled: page.enabled,
    tagline: text(page.tagline),
    taglineBn: text(page.taglineBn),
    establishedYear: profile.establishedYear?.toString() ?? "",
    about: text(page.about),
    aboutBn: text(page.aboutBn),
    facts: page.facts.map((f) => ({
      value: f.value,
      label: f.label,
      labelBn: text(f.labelBn),
    })),
    highlights: page.highlights.map((h) => ({
      title: h.title,
      titleBn: text(h.titleBn),
      body: text(h.body),
      bodyBn: text(h.bodyBn),
    })),
    principalName: text(profile.principalName),
    principalMessage: text(page.principalMessage),
    principalMessageBn: text(page.principalMessageBn),
    admissionOpen: page.admission.open,
    admissionNote: text(page.admission.note),
    admissionNoteBn: text(page.admission.noteBn),
    showContact: page.showContact,
    showAddress: page.showAddress,
    showNotices: page.showNotices,
    noticeLimit: String(page.noticeLimit),
  }
}

/**
 * English texts with no Bangla twin yet: a Bangla reader sees the English
 * there. Only parts the page shows count.
 */
export function missingBangla(v: HomeValues): number {
  const pairs: [string, string][] = [
    [v.tagline, v.taglineBn],
    [v.about, v.aboutBn],
    [v.principalMessage, v.principalMessageBn],
    ...(v.admissionOpen
      ? [[v.admissionNote, v.admissionNoteBn] as [string, string]]
      : []),
    ...v.facts.map((f): [string, string] => [f.label, f.labelBn]),
    ...v.highlights.flatMap((h): [string, string][] => [
      [h.title, h.titleBn],
      [h.body, h.bodyBn],
    ]),
  ]
  return pairs.filter(([en, bn]) => filled(en) && !filled(bn)).length
}

/** The text in `lang`, else the English, else the Bangla. */
export const pick = (lang: ContentLang, en: string, bn: string) =>
  (lang === "bn" ? bn.trim() : "") || en.trim() || bn.trim()

export type HomeErrors = Partial<Record<string, string>>

/** Error keys that only exist on the English side of the form. */
export const isEnglishOnlyError = (key: string) =>
  /^(fact-\d+-label|highlight-\d+-title)$/.test(key)

/** Checks what the backend would refuse; rows left blank are dropped. */
export function validate(v: HomeValues, t: (key: string) => string) {
  const errors: HomeErrors = {}
  const year = v.establishedYear.trim()
  if (year && !(/^\d{4}$/.test(year) && +year >= 1800 && +year <= 2100)) {
    errors.establishedYear = t("errors.year")
  }
  const limit = Number(v.noticeLimit)
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > HOME_PAGE_LIMITS.noticeLimit
  ) {
    errors.noticeLimit = t("errors.noticeLimit")
  }
  const facts = v.facts.filter((f) =>
    [f.value, f.label, f.labelBn].some(filled)
  )
  facts.forEach((f, i) => {
    if (!filled(f.value)) errors[`fact-${i}-value`] = t("errors.required")
    if (!filled(f.label)) errors[`fact-${i}-label`] = t("errors.required")
  })
  const highlights = v.highlights.filter((h) =>
    [h.title, h.titleBn, h.body, h.bodyBn].some(filled)
  )
  highlights.forEach((h, i) => {
    if (!filled(h.title)) errors[`highlight-${i}-title`] = t("errors.required")
  })
  return { errors, facts, highlights }
}

export function toPatch(
  v: HomeValues,
  facts: Fact[],
  highlights: Highlight[]
): ProfilePatch {
  const year = v.establishedYear.trim()
  return {
    establishedYear: year ? Number(year) : null,
    principalName: orNull(v.principalName),
    homePage: {
      enabled: v.enabled,
      tagline: orNull(v.tagline),
      taglineBn: orNull(v.taglineBn),
      about: orNull(v.about),
      aboutBn: orNull(v.aboutBn),
      principalMessage: orNull(v.principalMessage),
      principalMessageBn: orNull(v.principalMessageBn),
      facts: facts.map((f) => ({
        value: f.value.trim(),
        label: f.label.trim(),
        labelBn: orNull(f.labelBn),
      })),
      highlights: highlights.map((h) => ({
        title: h.title.trim(),
        titleBn: orNull(h.titleBn),
        body: orNull(h.body),
        bodyBn: orNull(h.bodyBn),
      })),
      admission: {
        open: v.admissionOpen,
        note: orNull(v.admissionNote),
        noteBn: orNull(v.admissionNoteBn),
      },
      showContact: v.showContact,
      showAddress: v.showAddress,
      showNotices: v.showNotices,
      noticeLimit: Number(v.noticeLimit),
    },
  }
}
