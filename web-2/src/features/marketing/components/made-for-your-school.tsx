import {
  BanknoteIcon,
  FileCheckIcon,
  LanguagesIcon,
  SignalIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Container, Section, SectionIntro } from "./section"

const POINTS = [
  {
    icon: LanguagesIcon,
    title: (
      <>
        English, <span className="font-bangla">বাংলা</span> and{" "}
        <span lang="hi" className="font-[family-name:var(--font-devanagari)]">
          हिन्दी
        </span>
      </>
    ),
    key: "language",
    body: "Every screen, report card and receipt in each language. Each person picks their own.",
  },
  {
    icon: FileCheckIcon,
    title: "Board rules, built in",
    key: "board",
    body: "Board-exam GPA scales, the optional-subject bonus and per-component pass marks, with Cambridge and madrasa scales available.",
  },
  {
    icon: BanknoteIcon,
    title: "Money, the way it's written",
    key: "money",
    body: "Amounts grouped the local way (11,20,000), native digits on Bangla screens, and your school's own time zone.",
  },
  {
    icon: SignalIcon,
    title: "Light on data",
    key: "light",
    body: "Pages are kept small so they open on a slow mobile connection and a mid-range Android phone.",
  },
]

export function MadeForYourSchool() {
  return (
    <Section className="bg-secondary/70">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-10">
          <SectionIntro
            eyebrow="Made for your school"
            title="Built for how schools actually work"
          >
            Generic ERPs weren&apos;t designed for board-exam grading, report
            cards in your own language or fees in your own currency. This one
            was.
          </SectionIntro>
          <p
            lang="bn"
            className="font-bangla text-5xl leading-tight font-extrabold text-primary [font-stretch:80%] sm:text-6xl"
          >
            আপনার স্কুল, আপনার ভাষায়।
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, key, body }) => (
            <Card key={key}>
              <CardHeader className="gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="size-5" />
                </span>
                <CardTitle className="text-base font-semibold">
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="leading-relaxed text-muted-foreground">
                {body}
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}
