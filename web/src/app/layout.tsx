import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Manrope,
  Noto_Sans_Bengali,
} from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Manrope has no Bengali glyphs; `[lang="bn"]` text switches to this.
const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kampasy — School management software for Bangladesh",
  description:
    "Admissions, attendance, exams, fees and notices on one mobile-first school ERP. bKash & Nagad payments, GPA 5.0 results, Bangla and English. Free 30-day trial.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${bricolage.variable} ${bengali.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
