import { ONBOARDING_STEPS } from "../content";
import { Container, Eyebrow, SectionTitle } from "./primitives";

export function Onboarding() {
  return (
    <section className="bg-cream py-20 sm:py-28">
      <Container>
        <div className="text-center">
          <Eyebrow>Onboarding</Eyebrow>
          <SectionTitle className="text-ink mx-auto mt-3 max-w-xl">
            Live in two weeks, not two terms.
          </SectionTitle>
        </div>
        <ol className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
          {ONBOARDING_STEPS.map((step, i) => (
            <li
              key={step.title}
              className="border-border rounded-2xl border bg-white p-8"
            >
              <span className="bg-brand grid size-10 place-items-center rounded-full text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="text-ink mt-6 text-xl font-semibold">
                {step.title}
              </h3>
              <p className="text-ink-muted mt-2 leading-relaxed">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
