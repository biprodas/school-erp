import { Plus } from "lucide-react";
import { FAQS } from "../content";
import { Container, Eyebrow, SectionTitle } from "./primitives";

export function Faq() {
  return (
    <section id="faq" className="bg-cream scroll-mt-16 py-20 sm:py-28">
      <Container>
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <SectionTitle className="text-ink mt-3">
            Questions, answered.
          </SectionTitle>
        </div>
        <div className="divide-border border-border mx-auto mt-12 max-w-3xl divide-y overflow-hidden rounded-2xl border bg-white">
          {FAQS.map((faq) => (
            <details key={faq.question} name="faq" className="group">
              <summary className="text-ink focus-visible:bg-cream flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-6 font-medium outline-none [&::-webkit-details-marker]:hidden">
                {faq.question}
                <Plus className="text-ink-muted size-4 shrink-0 transition-transform group-open:rotate-45" />
              </summary>
              <p className="text-ink-muted -mt-2 px-6 pb-6 leading-relaxed">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
