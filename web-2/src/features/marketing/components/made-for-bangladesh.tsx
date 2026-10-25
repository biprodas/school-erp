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
        <span className="font-bangla">বাংলা</span> and English
      </>
    ),
    key: "language",
    body: "Every screen, report card and receipt in both languages. Each person picks their own.",
  },
  {
    icon: FileCheckIcon,
    title: "Board rules, built in",
    key: "board",
    body: "The GPA 5.0 scale, the 4th-subject bonus and per-component pass marks, with GPA 4.0, Cambridge and madrasa scales available.",
  },
  {
    icon: BanknoteIcon,
    title: "Taka, the way it's written",
    key: "taka",
    body: "Amounts in lakhs (৳১১,২০,০০০), Bangla numerals on Bangla screens, and the Dhaka time zone.",
  },
  {
    icon: SignalIcon,
    title: "Light on data",
    key: "light",
    body: "Pages are kept small so they open on a slow mobile connection and a mid-range Android phone.",
  },
]

export function MadeForBangladesh() {
  return (
    <Section className="bg-secondary/70">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-10">
          <SectionIntro
            eyebrow="Made for Bangladesh"
            title="Built for how schools here actually work"
          >
            Global ERPs weren&apos;t designed for board-exam grading, Bangla
            report cards or taka in lakhs. This one was, and it&apos;s ready to
            grow beyond Bangladesh too.
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
