import type { Metadata } from "next"
import {
  Bricolage_Grotesque,
  Geist_Mono,
  Hind_Siliguri,
  Noto_Sans_Bengali,
} from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"

import "./globals.css"
import { QueryProvider } from "~/components/query-provider"
import { ThemeProvider } from "~/components/theme-provider"
import { Toaster } from "~/components/ui/toast"
import { cn } from "~/lib/utils"

// Hind Siliguri covers Latin and Bangla, so mixed-language copy shares one face.
const fontSans = Hind_Siliguri({
  subsets: ["latin", "bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  variable: "--font-display",
})

const fontBangla = Noto_Sans_Bengali({
  subsets: ["bengali"],
  axes: ["wdth"],
  variable: "--font-bangla",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Kampasy, school management for Bangladesh",
    template: "%s | Kampasy",
  },
  description:
    "Attendance, results, fees and notices on one mobile-first platform, in Bangla and English.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        fontSans.variable,
        fontDisplay.variable,
        fontBangla.variable,
        fontMono.variable
      )}
    >
      <body>
        <NextIntlClientProvider>
          <QueryProvider>
            <ThemeProvider>
              <Toaster>{children}</Toaster>
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
