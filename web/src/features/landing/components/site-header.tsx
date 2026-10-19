"use client";

import Link from "next/link";
import { APP_LINKS } from "~/config/site";
import { NAV_LINKS } from "../content";
import { MobileMenu } from "./mobile-menu";
import { Container, Logo, pill } from "./primitives";
import { useActiveHref, useScrolled } from "./use-header-state";
import { cn } from "~/lib/utils";

const NAV_HREFS = NAV_LINKS.map((link) => link.href);

export function SiteHeader() {
  const scrolled = useScrolled();
  const activeHref = useActiveHref(NAV_HREFS);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none",
        scrolled
          ? "border-border/80 bg-cream/85 shadow-[0_1px_12px_-6px_oklch(0.19_0.035_260/0.15)] backdrop-blur-md"
          : "bg-cream border-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="border-border/80 flex items-center gap-0.5 rounded-full border bg-white/60 p-1 text-sm">
            {NAV_LINKS.map((link) => {
              const active = link.href === activeHref;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "location" : undefined}
                    className={cn(
                      "focus-visible:ring-ring/50 block rounded-full px-3.5 py-1.5 transition-colors outline-none focus-visible:ring-3 xl:px-4",
                      active
                        ? "text-ink bg-white font-semibold shadow-[0_1px_3px_oklch(0.19_0.035_260/0.12)]"
                        : "text-ink/70 hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/find-school"
            className="text-ink hover:text-brand focus-visible:ring-ring/50 hidden rounded-full px-2 py-1 text-sm font-semibold outline-none focus-visible:ring-3 sm:inline"
          >
            Sign in
          </Link>
          <a
            href={APP_LINKS.signup}
            className={cn(pill.primary, "hidden h-10 px-5 sm:inline-flex")}
          >
            Start free trial
          </a>
          <MobileMenu activeHref={activeHref} />
        </div>
      </Container>
    </header>
  );
}
