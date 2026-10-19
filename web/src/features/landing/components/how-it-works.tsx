import { ClipboardCheck, FileCheck2, Wallet } from "lucide-react";
import { HOW_IT_WORKS } from "../content";
import { Container, Eyebrow, SectionTitle } from "./primitives";

const ICONS = {
  attendance: ClipboardCheck,
  fees: Wallet,
  results: FileCheck2,
} as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-cream scroll-mt-16 py-20 sm:py-28">
      <Container>
        <div className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <SectionTitle className="text-ink mx-auto mt-3 max-w-2xl">
            The busywork runs itself.
          </SectionTitle>
          <p className="text-ink-muted mx-auto mt-5 max-w-xl text-lg leading-relaxed">
            Someone does one small thing, and Kampasy carries it the rest of the
            way, all the way to the guardian&apos;s phone.
          </p>
        </div>

        <ul className="mt-14 grid gap-4 lg:grid-cols-3">
          {HOW_IT_WORKS.map((flow) => {
            const Icon = ICONS[flow.id];
            return (
              <li
                key={flow.id}
                className="border-border flex flex-col rounded-2xl border bg-white p-7"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-brand-soft text-brand grid size-10 shrink-0 place-items-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-ink text-lg font-bold tracking-tight">
                      {flow.title}
                    </h3>
                    <p className="text-ink-muted text-xs">{flow.who}</p>
                  </div>
                </div>

                <ol className="mt-7">
                  {flow.steps.map((step, i) => {
                    const last = i === flow.steps.length - 1;
                    return (
                      <li
                        key={step.title}
                        className="relative flex gap-4 pb-6 last:pb-0"
                      >
                        {!last && (
                          <span
                            aria-hidden
                            className="bg-border absolute start-[0.8125rem] top-7 bottom-1 w-px"
                          />
                        )}
                        <span
                          className={
                            last
                              ? "bg-brand grid size-[1.625rem] shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                              : "border-border text-ink grid size-[1.625rem] shrink-0 place-items-center rounded-full border bg-white text-xs font-bold"
                          }
                        >
                          {i + 1}
                        </span>
                        <div className="pt-0.5">
                          <p className="text-ink font-semibold">{step.title}</p>
                          <p className="text-ink-muted mt-1 text-sm leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
