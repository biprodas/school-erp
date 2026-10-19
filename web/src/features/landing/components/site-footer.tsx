import Link from "next/link";
import { KampasyMark } from "~/components/brand/kampasy-mark";
import { COMPANY_LOCATION, CONTACT_EMAIL } from "~/config/site";
import { Container } from "./primitives";

const LINK_COLUMNS = [
  [
    { label: "How it works", href: "/#how-it-works" },
    { label: "For your team", href: "/#roles" },
    { label: "FAQ", href: "/#faq" },
  ],
  [
    { label: "Modules", href: "/#modules" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Find your school", href: "/find-school" },
  ],
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-[oklch(0.33_0.05_163)] text-white">
      <Container className="grid max-w-6xl gap-10 py-14 md:grid-cols-[1.3fr_1fr_auto] md:gap-12">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            aria-label="Kampasy home"
          >
            <KampasyMark className="size-7" />
            <span className="font-heading text-lg font-bold tracking-tight">
              Kampasy
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">
            School management for Bangladesh, in Bangla and English.
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12">
          {LINK_COLUMNS.map((column, i) => (
            <ul key={i} className="space-y-3 text-sm text-white/80">
              {column.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-white focus-visible:text-white focus-visible:underline focus-visible:outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>

        <address className="space-y-2 text-sm text-white/80 not-italic">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="block transition-colors hover:text-white focus-visible:underline focus-visible:outline-none"
          >
            {CONTACT_EMAIL}
          </a>
          <p>{COMPANY_LOCATION}</p>
        </address>
      </Container>

      <div className="border-t border-white/10">
        <Container className="max-w-6xl py-6 text-xs text-white/60">
          © <CopyrightYear /> Kampasy
        </Container>
      </div>
    </footer>
  );
}

// Cache Components forbids `new Date()` during prerender; caching it fixes the
// year at build/revalidation time, which is precise enough for a copyright line.
async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}
