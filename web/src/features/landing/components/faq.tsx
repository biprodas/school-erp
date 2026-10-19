import Link from "next/link";
import { Mail, Plus } from "lucide-react";
import { CONTACT_EMAIL } from "~/config/site";
import { FAQ_GROUPS } from "../content";
import { Container, SectionTitle, pill } from "./primitives";
import { cn } from "~/lib/utils";

export function Faq() {
  return (
    <section id="faq" className="bg-cream scroll-mt-16 py-20 sm:py-28">
      <Container className="grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionTitle className="text-ink max-w-md">
            Questions schools ask before switching.
          </SectionTitle>
          <p className="text-ink-muted mt-5 max-w-sm text-lg leading-relaxed">
            Short answers to what principals and owners ask us most.
          </p>
          <HelpPanel className="mt-10 hidden lg:block" />
        </div>

        <div className="space-y-12">
          {FAQ_GROUPS.map((group, g) => (
            <div key={group.title}>
              <h3 className="text-ink-muted font-sans text-sm font-semibold">
                {group.title}
              </h3>
              <div className="border-ink/10 mt-3 border-t">
                {group.items.map((faq, i) => (
                  <details
                    key={faq.question}
                    // One shared name makes the list exclusive: opening a
                    // question closes the one that was open.
                    name="faq"
                    open={g === 0 && i === 0}
                    className="group border-ink/10 border-b [interpolate-size:allow-keywords] details-content:h-0 details-content:overflow-clip details-content:transition-[height,content-visibility] details-content:[transition-behavior:allow-discrete] details-content:duration-300 details-content:ease-out open:details-content:h-auto motion-reduce:details-content:transition-none"
                  >
                    <summary className="text-ink hover:text-brand focus-visible:ring-brand-strong/40 flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-5 text-[1.0625rem] font-semibold transition-colors outline-none focus-visible:ring-3 [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <span
                        aria-hidden
                        className="border-ink/15 text-ink group-open:border-brand group-open:bg-brand grid size-8 shrink-0 place-items-center rounded-full border transition-colors group-open:text-white"
                      >
                        <Plus className="size-4 transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none" />
                      </span>
                    </summary>
                    <p className="text-ink-muted max-w-[62ch] pe-14 pb-6 leading-relaxed">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          ))}

          <HelpPanel className="lg:hidden" />
        </div>
      </Container>
    </section>
  );
}

function HelpPanel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-border rounded-2xl border bg-white p-6 sm:p-7",
        className,
      )}
    >
      <p className="text-ink font-heading text-xl font-bold tracking-tight">
        Still deciding?
      </p>
      <p className="text-ink-muted mt-2 text-sm leading-relaxed">
        Get a 30-minute walkthrough with your own classes and fee heads, or
        write to us with anything not covered here.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
        <Link href="/#contact" className={cn(pill.primary, "h-10 px-5")}>
          Book a walkthrough
        </Link>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={cn(pill.outline, "h-10 px-5")}
        >
          <Mail className="size-4" /> Email us
        </a>
      </div>
      <p className="text-ink-muted border-border mt-6 border-t pt-4 text-sm">
        Already using Kampasy?{" "}
        <Link
          href="/find-school"
          className="text-ink font-semibold underline-offset-4 hover:underline"
        >
          Sign in to your school
        </Link>
      </p>
    </div>
  );
}
