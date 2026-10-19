import { LINKS, SITE } from "~/config/site";
import { Logo } from "./logo";
import { NAV } from "./site-header";
import { StartForm } from "./start-form";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="bg-canvas">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid items-center gap-10 rounded-[1.75rem] bg-[linear-gradient(135deg,var(--cta-from),var(--cta-to)_60%)] p-8 ring-1 ring-(--cta-ring) ring-inset text-white sm:p-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:p-16">
          <div>
            <h2 id="cta-title" className="display text-[2.8rem] text-balance sm:text-[3.6rem]">
              Start with one section tomorrow morning
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/75">
              30 days of Standard, free, with no card. Bring the rest of the school on when
              you&apos;re ready.
            </p>
            <p className="mt-6 text-[15px] text-white/75">
              Prefer a walkthrough first?{" "}
              <a className="font-semibold text-white underline underline-offset-4" href={LINKS.demo}>
                Book a demo
              </a>
            </p>
          </div>
          <StartForm />
        </div>
      </div>
    </section>
  );
}

const COLUMNS = [
  { title: "Product", links: NAV },
  {
    title: "Resources",
    links: [
      { href: LINKS.login, label: "Find your school" },
      { href: LINKS.demo, label: "Book a demo" },
      { href: LINKS.signup, label: "Start free trial" },
      // Internal reference page, linked only while developing.
      ...(process.env.NODE_ENV === "development"
        ? [{ href: "/design-system", label: "Design system" }]
        : []),
    ],
  },
  {
    title: "Legal",
    links: [
      { href: LINKS.privacy, label: "Privacy policy" },
      { href: LINKS.terms, label: "Terms of service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]">
        <div className="max-w-xs">
          <Logo light />
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            School management for Bangladesh, in Bangla and English.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold text-white/60">{col.title}</h2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a className="text-white/85 hover:text-white" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <h2 className="text-sm font-semibold text-white/60">Contact</h2>
          <address className="mt-3 space-y-2 text-[15px] not-italic">
            <a className="block text-white/85 hover:text-white" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
            <p className="text-white/70">{SITE.location}</p>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-white/60 sm:px-6">© 2026 {SITE.name}</p>
      </div>
    </footer>
  );
}
