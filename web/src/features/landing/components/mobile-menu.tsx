"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { APP_LINKS } from "~/config/site";
import { NAV_LINKS } from "../content";
import { pill } from "./primitives";
import { cn } from "~/lib/utils";

export function MobileMenu({ activeHref }: { activeHref: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="border-border text-ink hover:bg-cream focus-visible:ring-ring/50 grid size-10 place-items-center rounded-full border bg-white outline-none focus-visible:ring-3"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <>
          {/* Backdrop: dims the page and closes the menu when tapped */}
          <div
            aria-hidden
            onClick={close}
            className="bg-ink/30 animate-in fade-in fixed inset-x-0 top-16 bottom-0 motion-reduce:animate-none"
          />
          <div
            id="mobile-menu"
            className="border-border bg-cream animate-in fade-in slide-in-from-top-2 absolute inset-x-0 top-16 border-b shadow-lg motion-reduce:animate-none"
          >
            <nav
              aria-label="Mobile"
              className="mx-auto max-w-7xl px-4 py-4 sm:px-6"
            >
              <ul className="space-y-1">
                {NAV_LINKS.map((link) => {
                  const active = link.href === activeHref;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={close}
                        aria-current={active ? "location" : undefined}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-3 py-3 font-medium",
                          active
                            ? "text-ink bg-white shadow-[0_1px_3px_oklch(0.19_0.035_260/0.1)]"
                            : "text-ink/80 hover:bg-ink/5",
                        )}
                      >
                        {link.label}
                        {active && (
                          <span className="bg-brand size-1.5 rounded-full" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="border-border mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                <Link
                  href="/find-school"
                  onClick={close}
                  className={pill.outline}
                >
                  Sign in to your school
                </Link>
                <a href={APP_LINKS.signup} className={pill.primary}>
                  Start free trial
                </a>
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
