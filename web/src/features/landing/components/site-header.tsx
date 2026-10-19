import Link from "next/link";
import { NAV_LINKS } from "../content";
import { Container, Logo, pill } from "./primitives";
import { cn } from "~/lib/utils";

export function SiteHeader() {
  return (
    <header className="border-border/70 bg-cream/85 sticky top-0 z-50 border-b backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="text-ink/75 flex items-center gap-8 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="hover:text-ink transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-ink hover:text-brand text-sm font-semibold"
          >
            Sign in
          </Link>
          <a href="#demo" className={cn(pill.primary, "h-10 px-5")}>
            Book a demo
          </a>
        </div>
      </Container>
    </header>
  );
}
