"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ROOT_DOMAIN, schoolLoginUrl } from "~/config/site";
import { cn } from "~/lib/utils";

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

/**
 * Every school signs in on its own subdomain, so the marketing site only
 * routes people there.
 */
export function FindSchoolForm() {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = String(new FormData(event.currentTarget).get("slug") ?? "")
      .trim()
      .toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      setError(
        "Use the short name from your school's address, like greenfield.",
      );
      return;
    }
    window.location.assign(schoolLoginUrl(slug));
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="school-slug" className="text-ink text-sm font-semibold">
        Your school&apos;s address
      </label>
      <div
        className={cn(
          "border-border focus-within:border-brand-strong focus-within:ring-brand-strong/25 mt-2 flex h-12 items-center rounded-full border bg-white ps-5 pe-1.5 transition-shadow focus-within:ring-3",
          error && "border-destructive focus-within:ring-destructive/20",
        )}
      >
        <input
          id="school-slug"
          name="slug"
          placeholder="your-school"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "school-slug-error" : "school-slug-hint"}
          onChange={() => setError(null)}
          className="text-ink placeholder:text-ink-muted/70 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <span className="text-ink-muted hidden shrink-0 pe-3 text-sm sm:inline">
          .{ROOT_DOMAIN}
        </span>
        <button
          type="submit"
          aria-label="Go to my school"
          className="bg-brand hover:bg-brand/90 focus-visible:ring-ring/50 grid size-9 shrink-0 place-items-center rounded-full text-white outline-none focus-visible:ring-3"
        >
          <ArrowRight className="size-4" />
        </button>
      </div>
      {error ? (
        <p id="school-slug-error" className="text-destructive mt-2 text-xs">
          {error}
        </p>
      ) : (
        <p id="school-slug-hint" className="text-ink-muted mt-2 text-xs">
          Staff, students and guardians all sign in here.
        </p>
      )}
    </form>
  );
}
