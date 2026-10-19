"use client";

import { useState } from "react";
import { Container, SectionTitle, pill } from "./primitives";

export function DemoCta() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  // TODO: send the request to the demo-booking endpoint once it exists.
  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    setSubmittedEmail(String(email));
  }

  return (
    <section id="demo" className="bg-cream scroll-mt-16 pb-20 sm:pb-28">
      <Container className="max-w-[86rem]">
        <div className="bg-ink rounded-3xl px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <SectionTitle className="mx-auto max-w-2xl">
            Give your school the system it deserves.
          </SectionTitle>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/65">
            See Kampasy with your own workflows in a free, no-pressure 30-minute
            demo.
          </p>
          {submittedEmail ? (
            <p role="status" className="text-highlight mt-10 font-semibold">
              Thanks! We&apos;ll reach out to {submittedEmail} within one
              working day.
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <label htmlFor="demo-email" className="sr-only">
                Work email
              </label>
              <input
                id="demo-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="principal@yourschool.edu"
                className="focus-visible:border-highlight focus-visible:ring-highlight/30 h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-sm text-white outline-none placeholder:text-white/45 focus-visible:ring-3"
              />
              <button type="submit" className={pill.highlight}>
                Book demo
              </button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
