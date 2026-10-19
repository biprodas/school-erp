import { BellRing, FileCheck2, Languages, Wallet } from "lucide-react";
import { WHY } from "../content";
import { Container, SectionTitle } from "./primitives";

const ICONS = {
  fees: Wallet,
  attendance: BellRing,
  results: FileCheck2,
  language: Languages,
} as const;

export function Why() {
  return (
    <section id="why" className="bg-cream scroll-mt-16 py-20 sm:py-28">
      <Container className="max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-end lg:gap-16">
          <SectionTitle className="text-ink max-w-md">
            Less paperwork. More teaching.
          </SectionTitle>
          <p className="text-ink-muted max-w-xl text-lg leading-relaxed">
            Most schools still run on registers, Excel sheets and phone calls.
            Here&apos;s what changes when it all moves to one system.
          </p>
        </div>

        <div className="mt-14">
          {/* Column labels, shown once; on phones each row labels itself */}
          <div className="text-ink-muted hidden pb-3 text-sm font-semibold md:grid md:grid-cols-[1fr_1.4fr] md:gap-12">
            <span>Before</span>
            <span>With Kampasy</span>
          </div>

          <ul className="border-ink/10 border-t">
            {WHY.map((item) => {
              const Icon = ICONS[item.id];
              return (
                <li
                  key={item.id}
                  className="border-ink/10 grid gap-4 border-b py-8 md:grid-cols-[1fr_1.4fr] md:gap-12"
                >
                  <p className="text-ink-muted md:pt-1">
                    <span className="sr-only">Before: </span>
                    <span
                      aria-hidden
                      className="text-ink-muted/80 mb-1 block text-xs font-semibold md:hidden"
                    >
                      Before
                    </span>
                    <s className="text-lg leading-snug decoration-[oklch(0.6_0.17_25)]/70 decoration-2">
                      {item.before}
                    </s>
                  </p>

                  <div className="flex gap-4">
                    <span className="bg-brand grid size-10 shrink-0 place-items-center rounded-xl text-white">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-ink text-xl font-bold tracking-tight">
                        {item.title}
                      </h3>
                      <p className="text-ink-muted mt-2 max-w-prose leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
