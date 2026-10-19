"use client";

import { useState } from "react";
import { pill } from "./primitives";

export function WalkthroughForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  // TODO: send the request to the demo-booking endpoint once it exists.
  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    setSubmittedEmail(String(email));
  }

  if (submittedEmail) {
    return (
      <p role="status" className="text-highlight font-semibold">
        Demo requested. We&apos;ll email {submittedEmail} to pick a time.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="demo-email" className="sr-only">
        Your email
      </label>
      <input
        id="demo-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="principal@yourschool.edu.bd"
        className="focus-visible:border-highlight focus-visible:ring-highlight/30 h-11 min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-5 text-sm text-white outline-none placeholder:text-white/60 focus-visible:ring-3"
      />
      <button type="submit" className={pill.highlight}>
        Book demo
      </button>
    </form>
  );
}
