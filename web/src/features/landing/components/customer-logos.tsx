import { CUSTOMER_LOGOS } from "../content";
import { Container } from "./primitives";

export function CustomerLogos() {
  return (
    <section className="border-border border-y bg-white py-12">
      <Container className="text-center">
        <p className="text-ink-muted text-xs font-semibold tracking-[0.14em] uppercase">
          Powering schools, colleges and school groups
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {CUSTOMER_LOGOS.map((name) => (
            <li
              key={name}
              className="font-heading text-ink/45 text-lg font-semibold"
            >
              {name}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
