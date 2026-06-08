import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { PLATFORM_SIGNUP } from "~/constants/routes";

const stats = [
  { value: "500+", label: "Schools Onboarded" },
  { value: "2M+", label: "Students Managed" },
  { value: "98%", label: "Uptime SLA" },
  { value: "4.9★", label: "Average Rating" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-6 gap-1.5 py-1 text-xs">
            <span className="size-1.5 rounded-full bg-green-500" />
            Now with AI-powered insights
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The modern ERP built{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative">for schools</span>
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            SchoolERP unifies academics, finance, HR, and communication on a
            single platform — so your staff spends less time on admin and more
            time on education.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href={PLATFORM_SIGNUP}>
                Start Free Trial <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">See Features</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
