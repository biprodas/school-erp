import { TESTIMONIAL } from "../content";
import { Container } from "./primitives";

export function Testimonial() {
  return (
    <section className="bg-brand-soft py-20 sm:py-28">
      <Container>
        <figure className="mx-auto max-w-4xl text-center">
          <blockquote className="font-heading text-brand text-2xl leading-snug font-semibold text-balance sm:text-4xl">
            “{TESTIMONIAL.quote}”
          </blockquote>
          <figcaption className="mt-8 text-sm">
            <span className="text-ink block font-semibold">
              {TESTIMONIAL.author}
            </span>
            <span className="text-brand/80">{TESTIMONIAL.role}</span>
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
