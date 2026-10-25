import { ArrowRightIcon, CheckIcon } from "lucide-react"

import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import { BRAND } from "~/config/brand-config"
import { cn } from "~/lib/utils"
import { AttendanceDemo } from "./attendance-demo"
import { DEMO_HREF, SIGNUP_HREF } from "../links"
import { Container } from "./section"

const ASSURANCES = [
  "No card required",
  "Running within a day",
  "Free up to 100 students",
]

const STATS = [
  { value: "< 24 h", label: "from sign-up to the first attendance taken" },
  { value: "≤ 3 days", label: "to publish results after the last exam" },
  { value: "360 px", label: "every core task works on a small phone" },
  { value: "100%", label: "of money and mark changes kept in the audit log" },
]

export function Hero() {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[48px_48px]">
        <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/80 to-background" />
        <Container className="relative grid items-center gap-16 py-20 lg:grid-cols-[1fr_26rem] lg:py-28">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="outline" className="h-7 bg-card px-3 text-sm">
              <span className="size-1.5 rounded-full bg-primary" />
              Built for schools in Bangladesh,{" "}
              <span className="font-bangla">বাংলা</span> and English
            </Badge>
            <h1 className="font-display text-6xl leading-[0.9] text-balance sm:text-7xl lg:text-8xl">
              One register for the whole school.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Attendance, results, fees and notices on one mobile-first
              platform. Teachers mark a section in under a minute, guardians see
              their child&apos;s day in the portal, and the owner sees the
              day&apos;s collection before going home.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={SIGNUP_HREF}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 rounded-full px-5 text-base"
                )}
              >
                Get started free
                <ArrowRightIcon data-icon="inline-end" />
              </a>
              <a
                href={DEMO_HREF}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 rounded-full bg-card px-5 text-base"
                )}
              >
                Explore the demo
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {ASSURANCES.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckIcon className="size-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <AttendanceDemo />
            <p className="text-center text-sm text-muted-foreground">
              Try it. This is the screen a teacher uses at the start of class.
            </p>
          </div>
        </Container>
      </section>

      <section
        aria-label={`${BRAND.name} in numbers`}
        className="border-b bg-card"
      >
        <Container>
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col-reverse justify-end gap-1 py-8 pr-6 even:border-l even:pl-6 lg:not-first:border-l lg:not-first:pl-8"
              >
                <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="font-display text-4xl text-primary">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>
    </>
  )
}
