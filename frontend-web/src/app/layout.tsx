import type { Metadata, Viewport } from "next";
import { Anek_Bangla } from "next/font/google";
import { TooltipProvider } from "~/components/ui/tooltip";
import { SITE } from "~/config/site";
import { THEME_SCRIPT } from "~/lib/theme";
import "./globals.css";

const anek = Anek_Bangla({
  variable: "--font-anek",
  subsets: ["latin", "bengali"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${SITE.name}: school management for Bangladesh`,
  description:
    "Attendance, exams and GPA results, fees, notices and student records on one mobile-first platform. Every school gets its own workspace, in Bangla and English.",
};

export const viewport: Viewport = {
  themeColor: "#143f30",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // THEME_SCRIPT may add the `dark` class before hydration.
    <html lang="en" className={anek.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
