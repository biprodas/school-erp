import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import ReactQueryProvider from "~/providers/react-query-provider";
import { ThemeProvider } from "~/providers/theme-provider";
import { ToasterProvider } from "~/providers/toast-provider";

import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fontSans = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});



export const metadata: Metadata = {
  title: "SchoolERP — Modern School Management Platform",
  description:
    "SchoolERP unifies academics, finance, HR, and communication on a single platform. Trusted by 500+ schools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geistSans.className,
          geistMono.variable,
          inter.variable,
        )}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
            <ToasterProvider />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
