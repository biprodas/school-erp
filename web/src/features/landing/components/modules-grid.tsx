import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  FEATURED_MODULE_COUNT,
  MODULES,
  type ModuleAvailability,
} from "../content";
import { Container, SectionTitle } from "./primitives";
import { cn } from "~/lib/utils";

const AVAILABILITY_LABEL: Record<ModuleAvailability, string> = {
  live: "Available",
  soon: "Coming soon",
  roadmap: "On the roadmap",
};

export function ModulesGrid() {
  const featured = MODULES.slice(0, FEATURED_MODULE_COUNT);
  const hasMore = MODULES.length > featured.length;

  return (
    <section
      id="modules"
      className="bg-ink scroll-mt-16 py-20 text-white sm:py-28"
    >
      <Container>
        <p className="text-highlight text-xs font-bold tracking-[0.14em] uppercase">
          Modules
        </p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <SectionTitle className="max-w-2xl">
            Everything a school runs on — already connected.
          </SectionTitle>
          <p className="max-w-md text-lg leading-relaxed text-white/65">
            Start with the essentials every school needs on day one. New modules
            share the same students, staff and records as they arrive.
          </p>
        </div>
        <ModuleCards modules={featured} className="mt-14" />
        {hasMore && (
          <div className="mt-10 text-center">
            <Link
              href="/modules"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/20 px-6 text-sm font-semibold whitespace-nowrap text-white transition-colors outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/30"
            >
              View all {MODULES.length} modules{" "}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}

export function ModuleCards({
  modules,
  className,
}: {
  modules: readonly (typeof MODULES)[number][];
  className?: string;
}) {
  return (
    // gap-px over a tinted background draws the hairlines between cells
    <ul
      className={cn(
        "grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {modules.map((module, i) => {
        const live = module.availability === "live";
        return (
          <li
            key={module.title}
            className="bg-ink p-8 transition-colors hover:bg-[oklch(0.22_0.035_260)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "text-sm font-semibold",
                  live ? "text-highlight" : "text-white/35",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  live
                    ? "bg-brand-strong/25 text-[oklch(0.85_0.09_160)]"
                    : "border border-white/15 text-white/55",
                )}
              >
                {AVAILABILITY_LABEL[module.availability]}
              </span>
            </div>
            <h3
              className={cn(
                "mt-3 text-xl font-bold tracking-tight",
                !live && "text-white/80",
              )}
            >
              {module.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              {module.description}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
