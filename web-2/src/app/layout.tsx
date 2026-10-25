import type { Metadata } from "next"
import { headers } from "next/headers"
import {
  Bricolage_Grotesque,
  Geist_Mono,
  Hind,
  Hind_Siliguri,
  Noto_Sans_Bengali,
} from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"

import "./globals.css"
import { QueryProvider } from "~/components/providers/query-provider"
import { ThemeProvider } from "~/components/providers/theme-provider"
import { Toaster } from "~/components/ui/toast"
import { siteConfig } from "~/config/site-config"
import { NONCE_HEADER } from "~/lib/tenancy/host-headers"
import { cn } from "~/lib/utils"

// Fonts and slow connections: every subset gets an @font-face with its
// unicode-range, so the browser fetches a file only when the page shows
// those characters. `subsets` only says which files are preloaded; only
// the Latin faces English pages paint with are. Bangla and Hindi pages
// fetch their faces on use (`display: swap`), so an English page on 3G no
// longer downloads ~700 KB of fonts it never shows.

// Hind Siliguri covers Latin and Bangla, so mixed-language copy shares one face.
const fontSans = Hind_Siliguri({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

// Hind Siliguri's Devanagari sibling, for Hindi (globals.css swaps it in).
const fontDevanagari = Hind({
  subsets: ["latin", "devanagari"],
  preload: false,
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
})

const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  variable: "--font-display",
})

const fontBangla = Noto_Sans_Bengali({
  subsets: ["bengali"],
  preload: false,
  axes: ["wdth"],
  variable: "--font-bangla",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  preload: false,
  variable: "--font-mono",
})

// No `openGraph.url` here: school hosts inherit this, and their pages
// aren't the marketing site.
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.title,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    locale: siteConfig.locale,
    alternateLocale: [...siteConfig.alternateLocale],
  },
  twitter: {
    card: "summary",
    title: siteConfig.title,
    description: siteConfig.description,
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  // The CSP nonce `src/proxy.ts` made for this page, for the theme script.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        fontSans.variable,
        fontDisplay.variable,
        fontBangla.variable,
        fontDevanagari.variable,
        fontMono.variable
      )}
    >
      <body>
        <NextIntlClientProvider>
          <QueryProvider>
            <ThemeProvider nonce={nonce}>
              <Toaster>{children}</Toaster>
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
