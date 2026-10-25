import { appConfig } from "./app-config"

/**
 * The product's brand: its name, contact address and the prefix of its
 * cookies. Both brands stay here: "School ERP" for now, "Kampasy" for
 * later. To switch, point `BRAND` at the other one and swap `app/icon.svg`
 * with `components/brand/<brand>-icon.svg` (the favicon is a static file;
 * `BrandMark` and the Apple icon follow `BRAND`).
 *
 * Changing `cookiePrefix` renames the session cookies, which signs
 * everyone out once. The CSRF header value and the session key's HKDF
 * label keep the `kampasy` name: they are never shown.
 */
export const BRANDS = {
  kampasy: {
    id: "kampasy",
    name: "Kampasy",
    /** Schools live at `<slug>.<domain>`. */
    domain: "kampasy.com",
    contactEmail: "hello@kampasy.com",
    /** Session cookies are `<prefix>_session` and `<prefix>_admin`. */
    cookiePrefix: "kampasy",
  },
  schoolErp: {
    id: "school-erp",
    name: "School ERP",
    /** No domain of its own yet: the deployment's root domain. */
    domain: null,
    contactEmail: "contact@biprodas.dev",
    cookiePrefix: "school_erp",
  },
} as const

export type Brand = (typeof BRANDS)[keyof typeof BRANDS]

export const BRAND: Brand = BRANDS.schoolErp

/** The domain in example school addresses (`yourschool.<domain>`). */
export const brandDomain: string = BRAND.domain ?? appConfig.rootDomain
