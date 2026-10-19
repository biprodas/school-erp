import { MODULES } from "../content";
import { Container, SectionTitle } from "./primitives";

export function ModulesGrid() {
  return (
    <section
      id="modules"
      className="bg-ink scroll-mt-16 py-20 text-white sm:py-28"
    >
      <Container>
        <p className="text-highlight text-xs font-bold tracking-[0.14em] uppercase">
          Modules
        </p>
        <SectionTitle className="mt-3 max-w-2xl">
          Everything a school runs on — already connected.
        </SectionTitle>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
          Turn on what you need today, add more as you grow. Data flows between
          modules automatically.
        </p>
        {/* gap-px over a tinted background draws the hairlines between cells */}
        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module, i) => (
            <li
              key={module.title}
              className="bg-ink p-8 transition-colors hover:bg-[oklch(0.22_0.035_260)]"
            >
              <span className="text-highlight text-sm font-semibold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-xl font-bold tracking-tight">
                {module.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {module.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
