import { ONBOARDING_STEPS } from "../content";
import { Container, Eyebrow, SectionTitle } from "./primitives";

export function Onboarding() {
  return (
    <section className="bg-cream pt-20 pb-16 sm:pt-28 sm:pb-20">
      <Container className="max-w-6xl">
        <div className="text-center">
          <Eyebrow>Self-serve onboarding</Eyebrow>
          <SectionTitle className="text-ink mx-auto mt-3 max-w-2xl">
            From signup to first roll call in under a day.
          </SectionTitle>
        </div>
        <ol className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {ONBOARDING_STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="font-heading text-highlight text-5xl font-bold tracking-tight">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="border-border mt-3 border-t pt-5">
                <h3 className="text-ink font-sans text-lg font-bold">
                  {step.title}
                </h3>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
