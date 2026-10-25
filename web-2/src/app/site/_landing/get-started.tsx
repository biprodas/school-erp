"use client"

import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { slugify } from "~/lib/slugs"
import { DEMO_HREF, SIGNUP_HREF } from "./links"
import { Container, DisplayHeading } from "./section"

export function GetStarted() {
  const [name, setName] = useState("")
  const slug = slugify(name) || "yourschool"

  return (
    <section id="get-started" className="scroll-mt-16 pb-20 sm:pb-24">
      <Container>
        <div className="grid items-center gap-10 rounded-3xl bg-linear-to-br from-primary to-brand p-8 text-brand-foreground sm:p-14 lg:grid-cols-[1fr_24rem]">
          <div className="flex flex-col gap-5">
            <DisplayHeading>
              Start with one section tomorrow morning
            </DisplayHeading>
            <p className="max-w-lg text-lg leading-relaxed text-brand-foreground/80">
              30 days of Standard, free, with no card. Bring the rest of the
              school on when you&apos;re ready.
            </p>
            <p className="text-sm text-brand-foreground/80">
              Prefer a walkthrough first?{" "}
              <a
                href={DEMO_HREF}
                className="font-semibold text-brand-foreground underline underline-offset-4"
              >
                Book a demo
              </a>
            </p>
          </div>
          <form
            className="flex flex-col gap-3 rounded-2xl bg-brand-foreground/8 p-6 ring-1 ring-brand-foreground/10"
            action={SIGNUP_HREF}
            method="get"
          >
            <Label htmlFor="school-name">Your school&apos;s name</Label>
            <Input
              id="school-name"
              name="schoolName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Shapla Model School"
              autoComplete="organization"
              className="h-11 border-brand-foreground/20 bg-brand-foreground/10 text-brand-foreground placeholder:text-brand-foreground/50 dark:bg-brand-foreground/10"
            />
            <p className="text-sm text-brand-foreground/75">
              Your address will be{" "}
              <span className="font-semibold text-brand-foreground">
                {slug}.kampasy.com
              </span>
            </p>
            <Button
              type="submit"
              size="lg"
              className="mt-2 h-11 rounded-full bg-highlight text-base text-highlight-foreground hover:bg-highlight/85"
            >
              Start free trial
            </Button>
          </form>
        </div>
      </Container>
    </section>
  )
}
