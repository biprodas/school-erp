import { SECURITY_FEATURES } from "../content";
import { Container, Eyebrow, SectionTitle } from "./primitives";

export function Security() {
  return (
    <section
      id="security"
      className="border-border scroll-mt-16 border-y bg-white py-20 sm:py-28"
    >
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>Security &amp; reliability</Eyebrow>
          <SectionTitle className="text-ink mt-3 max-w-lg">
            Student data deserves bank-grade care.
          </SectionTitle>
          <p className="text-ink-muted mt-5 max-w-xl text-lg leading-relaxed">
            Built multi-tenant from day one, with encryption in transit and at
            rest, and 99.9% uptime.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SECURITY_FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="border-border bg-cream rounded-2xl border p-6"
            >
              <span className="bg-highlight block h-1 w-8 rounded-full" />
              <h3 className="text-ink mt-6 font-sans font-bold">
                {feature.title}
              </h3>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
