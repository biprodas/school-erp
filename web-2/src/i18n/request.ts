import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { DEFAULT_TIME_ZONE } from "~/lib/format"

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config"

// No locale in the URL (the host already carries the school), so the
// locale comes from the viewer's cookie.
export default getRequestConfig(async () => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(value) ? value : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: DEFAULT_TIME_ZONE,
  }
})
