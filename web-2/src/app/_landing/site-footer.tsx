import Link from "next/link"

import { Separator } from "~/components/ui/separator"
import {
  CONTACT_EMAIL,
  DEMO_HREF,
  FIND_SCHOOL_HREF,
  NAV_LINKS,
  SIGNUP_HREF,
} from "./links"
import { Logo } from "./logo"
import { Container } from "./section"

const COLUMNS = [
  { title: "Product", links: NAV_LINKS },
  {
    title: "Resources",
    links: [
      { label: "Find your school", href: FIND_SCHOOL_HREF },
      { label: "Book a demo", href: DEMO_HREF },
      { label: "Start free trial", href: SIGNUP_HREF },
      { label: "Design system", href: "/design-system" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-brand text-brand-foreground">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-brand-foreground/75">
            School management for Bangladesh, in Bangla and English.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold text-brand-foreground/60">
              {column.title}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="hover:underline hover:underline-offset-4"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <h2 className="text-sm font-semibold text-brand-foreground/60">
            Contact
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="hover:underline hover:underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            </li>
            <li className="text-brand-foreground/75">Dhaka, Bangladesh</li>
          </ul>
        </div>
      </Container>
      <Separator className="bg-brand-foreground/10" />
      <Container className="py-6 text-sm text-brand-foreground/60">
        © {new Date().getFullYear()} Kampasy
      </Container>
    </footer>
  )
}
