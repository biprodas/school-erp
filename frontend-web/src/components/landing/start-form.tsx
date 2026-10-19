"use client";

import { useState } from "react";
import { LINKS, SITE } from "~/config/site";

/** "Shapla Model School" → "shapla-model-school", the way signup suggests a slug. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function StartForm() {
  const [name, setName] = useState("");
  const slug = slugify(name) || "yourschool";

  return (
    <form action={LINKS.signup} method="get" className="rounded-2xl bg-white/[0.07] p-6 ring-1 ring-white/10">
      <label htmlFor="school-name" className="text-sm font-semibold">
        Your school&apos;s name
      </label>
      <input
        id="school-name"
        name="school"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Shapla Model School"
        autoComplete="organization"
        className="mt-2 h-12 w-full rounded-xl bg-white/10 px-4 text-white ring-1 ring-white/20 placeholder:text-white/45 focus:ring-2 focus:ring-marigold focus:outline-none"
      />
      <p className="mt-3 truncate text-sm text-white/70" aria-live="polite">
        Your address will be{" "}
        <span className="font-semibold text-white">
          {slug}.{SITE.rootDomain}
        </span>
      </p>
      <button
        type="submit"
        className="mt-5 h-12 w-full rounded-full bg-marigold text-[17px] font-semibold text-ink transition-colors hover:bg-marigold-hover"
      >
        Start free trial
      </button>
    </form>
  );
}
