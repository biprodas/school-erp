import type messages from "../../messages/en.json"
import type { Locale } from "./config"

// Typed `useTranslations` keys: English is the reference catalog, and
// `bn.json` must have the same keys (checked in `messages.test.ts`).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages
  }
}
