import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowRight, Zap, Globe, Lock, HeadphonesIcon } from "lucide-react";
import { ONBOARDING_SIGNUP } from "~/constants/routes";

const trustBadges = [
  { icon: Zap, label: "99.9% Uptime" },
  { icon: Globe, label: "Multi-language" },
  { icon: Lock, label: "SOC 2 Compliant" },
  { icon: HeadphonesIcon, label: "24/7 Support" },
];

export function CtaSection() {
  return (
    <section id="contact" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-primary px-8 py-16 text-center text-primary-foreground shadow-lg">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to modernise your school?
          </h2>
          <p className="mt-4 text-primary-foreground/70">
            Join 500+ institutions already running smarter with SchoolERP. Start
            your free 14-day trial today.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link
                href={ONBOARDING_SIGNUP}
                className="inline-flex items-center justify-center gap-1.5"
              >
                Get Started Free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/50 bg-transparent text-primary-foreground shadow-none hover:bg-primary-foreground/15 hover:text-primary-foreground"
              asChild
            >
              <Link href="#contact" className="inline-flex items-center justify-center">
                Talk to Sales
              </Link>
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-6">
            {trustBadges.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.label}
                  className="flex items-center gap-2 text-sm text-primary-foreground/70"
                >
                  <Icon className="size-4" />
                  {b.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
