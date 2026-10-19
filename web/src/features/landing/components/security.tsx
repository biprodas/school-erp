import { Database, History, Lock, ShieldCheck } from "lucide-react";
import { SECURITY_FEATURES } from "../content";
import { Container } from "./primitives";

const ICONS = {
  isolation: Lock,
  audit: History,
  backups: Database,
  consent: ShieldCheck,
} as const;

export function Security() {
  return (
    <section id="security" className="bg-cream scroll-mt-16 pb-20 sm:pb-28">
      <Container className="max-w-6xl">
        <div className="grid gap-12 rounded-3xl bg-[oklch(0.2_0.03_170)] px-6 py-12 text-white sm:px-12 sm:py-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div className="lg:self-center">
            <ShieldCheck className="text-highlight size-9" strokeWidth={1.75} />
            <h2 className="mt-6 max-w-sm text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:text-4xl">
              Your school&apos;s data stays your school&apos;s.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-white/65">
              Student records, marks and money deserve bank-grade care. Trust is
              a product principle, not a feature.
            </p>
          </div>

          <ul className="grid gap-x-8 sm:grid-cols-2">
            {SECURITY_FEATURES.map((feature) => {
              const Icon = ICONS[feature.id];
              return (
                <li key={feature.id} className="border-t border-white/10 py-6">
                  <Icon className="text-highlight size-5" />
                  <h3 className="mt-3 font-sans font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {feature.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
