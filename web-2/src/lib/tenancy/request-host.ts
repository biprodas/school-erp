import "server-only"

import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { appConfig } from "~/config/app-config"

import {
  HOST_KIND_HEADER,
  REQUEST_ORIGIN_HEADER,
  TENANT_SLUG_HEADER,
} from "./host-headers"
import { urlOnHost } from "./hosts"

export type RequestHostKind = "site" | "admin" | "school" | "unknown"

export interface RequestHost {
  kind: RequestHostKind
  /** The school's slug on school and custom-domain hosts, else null. */
  slug: string | null
  /** `http://acme.lvh.me:3000`, as the browser sent it. */
  origin: string
}

/** The host `src/proxy.ts` resolved for this request. */
export async function getRequestHost(): Promise<RequestHost> {
  const h = await headers()
  const kind = h.get(HOST_KIND_HEADER)
  return {
    kind:
      kind === "site" || kind === "admin" || kind === "school"
        ? kind
        : "unknown",
    slug: h.get(TENANT_SLUG_HEADER),
    origin: h.get(REQUEST_ORIGIN_HEADER) ?? `http://${appConfig.rootDomain}`,
  }
}

/** The school's slug; 404 when the request isn't on a school host. */
export async function requireSchoolSlug(): Promise<string> {
  const { kind, slug } = await getRequestHost()
  if (kind !== "school" || !slug) notFound()
  return slug
}

/** An absolute URL on the marketing site, e.g. `/find-school`. */
export async function siteUrl(path = "/"): Promise<string> {
  const { origin } = await getRequestHost()
  return urlOnHost(origin, appConfig.rootDomain, path)
}
