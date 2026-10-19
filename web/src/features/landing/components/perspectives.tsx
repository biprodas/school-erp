"use client";

import { Check } from "lucide-react";
import { Tabs } from "@base-ui/react/tabs";
import { PERSPECTIVES } from "../content";
import { Container, Eyebrow, SectionTitle } from "./primitives";

export function Perspectives() {
  return (
    <section className="bg-cream py-20 sm:py-28">
      <Container className="text-center">
        <Eyebrow>Built for everyone</Eyebrow>
        <SectionTitle className="text-ink mx-auto mt-3 max-w-md">
          One platform. Four perspectives.
        </SectionTitle>
        <Tabs.Root defaultValue="teachers" className="mt-10">
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
              className="border-border mx-auto mt-10 max-w-3xl rounded-2xl border bg-white p-8 text-start shadow-[0_24px_50px_-28px_oklch(0.19_0.035_260/0.3)] outline-none sm:p-10"
            >
              <h3 className="text-ink text-2xl font-bold tracking-tight">
                {p.title}
              </h3>
              <ul className="mt-6 space-y-3">
                {p.points.map((point) => (
                  <li key={point} className="text-ink flex items-center gap-3">
                    <span className="bg-brand-soft text-brand grid size-5 shrink-0 place-items-center rounded-full">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </Tabs.Panel>
          ))}
        </Tabs.Root>
      </Container>
    </section>
  );
}
