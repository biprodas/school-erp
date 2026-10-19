"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** True once the page has scrolled past the top. */
export function useScrolled(threshold = 8) {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > threshold,
    () => false,
  );
}

/**
 * The `href` of the nav link whose section is in the middle band of the
 * viewport. On other pages, the link that points at that page (e.g. a
 * `/#modules` link while on `/modules`).
 */
export function useActiveHref(hrefs: readonly string[]) {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(null);
  const onHome = pathname === "/";

  useEffect(() => {
    if (!onHome) return;
    const sections = hrefs
      .map((href) => document.getElementById(href.split("#")[1] ?? ""))
      .filter((el): el is HTMLElement => el !== null);

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // The last visible section in page order wins.
        const current = sections.filter((s) => visible.has(s.id)).at(-1);
        setActiveId(current?.id ?? null);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [hrefs, onHome]);

  if (!onHome) {
    return hrefs.find((href) => href.endsWith(`#${pathname.slice(1)}`)) ?? null;
  }
  return activeId ? `/#${activeId}` : null;
}
