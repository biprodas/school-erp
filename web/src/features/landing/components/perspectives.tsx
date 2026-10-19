"use client";

import { Check } from "lucide-react";
import { Tabs } from "@base-ui/react/tabs";
import { PERSPECTIVES } from "../content";
import { Container, Eyebrow, SectionTitle } from "./primitives";

export function Perspectives() {
  return (
    <section
      id="roles"
      className="border-border scroll-mt-16 border-t bg-white py-20 sm:py-28"
    >
      <Container className="text-center">
        <Eyebrow>Built for everyone</Eyebrow>
        <SectionTitle className="text-ink mx-auto mt-3 max-w-xl">
          One platform. The right view for each role.
        </SectionTitle>
        <p className="text-ink-muted mx-auto mt-5 max-w-xl text-lg leading-relaxed">
          Roles decide what each person sees. Everyone signs in on your
          school&apos;s own address and lands on a workspace shaped around their
          job.
        </p>
        <Tabs.Root defaultValue="owners" className="mt-10">
          <Tabs.List
            aria-label="Choose a perspective"
            className="flex flex-wrap justify-center gap-2"
          >
            {PERSPECTIVES.map((p) => (
              <Tabs.Tab
                key={p.id}
                value={p.id}
                className="bg-ink/5 text-ink/80 hover:not-data-active:bg-ink/10 focus-visible:ring-ring/50 data-active:bg-ink rounded-full px-5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 data-active:font-semibold data-active:text-white"
              >
                {p.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {PERSPECTIVES.map((p) => (
            <Tabs.Panel
              key={p.id}
              value={p.id}
              className="border-border bg-cream mx-auto mt-10 grid max-w-5xl items-center gap-8 rounded-3xl border p-6 text-start outline-none sm:p-10 lg:grid-cols-[1.1fr_1fr]"
            >
              <div>
                <h3 className="text-ink text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                  {p.title}
                </h3>
                <ul className="mt-6 space-y-3">
                  {p.points.map((point) => (
                    <li key={point} className="text-ink flex items-start gap-3">
                      <span className="bg-brand-soft text-brand mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div
                aria-hidden
                className="border-border rounded-2xl border bg-white p-4 shadow-[0_24px_50px_-28px_oklch(0.19_0.035_260/0.3)]"
              >
                <p className="text-ink-muted px-1 pb-3 text-[11px] font-semibold tracking-[0.12em] uppercase">
                  {p.label} · today
                </p>
                <ul className="space-y-2">
                  {p.preview.map((row) => (
                    <li
                      key={row.label}
                      className="border-border flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
                    >
                      <span className="text-ink-muted text-sm">
                        {row.label}
                      </span>
                      <span className="font-heading text-ink text-end font-bold">
                        {row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      </Container>
    </section>
  );
}
