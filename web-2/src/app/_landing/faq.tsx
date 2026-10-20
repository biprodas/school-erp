import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { CONTACT_EMAIL } from "./links"
import { Container, Section, SectionIntro } from "./section"

const GROUPS = [
  {
    title: "Getting started",
    items: [
      {
        q: "How long does it take to get started?",
        a: "Most schools take their first attendance the day they sign up. A setup wizard walks you through your session, classes, sections, subjects and grading scale, then you invite teachers and import students.",
      },
      {
        q: "We keep our student list in Excel. Do we have to type it again?",
        a: "No. Download the import template, paste your list in, and upload it. Rows with problems are shown with the reason so you can fix them and upload again.",
      },
      {
        q: "Do teachers need a computer?",
        a: "No. Every everyday task, including attendance and mark entry, works on a phone with a small screen.",
      },
    ],
  },
  {
    title: "Plans & billing",
    items: [
      {
        q: "How does pricing work?",
        a: "You pay per active student each month, at the rate of your plan. Paying for the year gets you two months free. Every school starts with 30 days of Standard, without a card.",
      },
      {
        q: "Is the Free plan really free?",
        a: "Yes. Schools with up to 100 students can use the Free plan with no time limit.",
      },
      {
        q: "Can guardians pay fees online?",
        a: "Online payment through bKash and cards is on the way. Until then, fees are collected at the counter with numbered receipts, and guardians see what is paid and due in the portal.",
      },
    ],
  },
  {
    title: "Bangla & grading",
    items: [
      {
        q: "Is it available in Bangla?",
        a: "Yes. Every screen, report card and receipt is available in Bangla and English, and each person chooses their own language.",
      },
      {
        q: "We follow Cambridge, or we are a madrasa. Will the grading fit?",
        a: "Bangladesh board grading (GPA 5.0) is the default, and GPA 4.0, Cambridge and madrasa scales are available. You can also set up your own grade bands and pass marks.",
      },
    ],
  },
  {
    title: "Your school's data",
    items: [
      {
        q: "Is our school's data separate from other schools?",
        a: "Yes. Every record belongs to one school, and that is checked by the application and again by the database, so no school can read another's data.",
      },
      {
        q: "Can we use our own domain?",
        a: "Every school gets an address like yourschool.kampasy.com. On Standard and Premium you can also use your own, like erp.yourschool.edu.bd.",
      },
      {
        q: "Who can see what?",
        a: "Roles decide it. Teachers see their own classes, accountants see fees, and guardians see only their own children. You can adjust the standard roles or create your own.",
      },
    ],
  },
]

export function Faq() {
  return (
    <Section id="faq" className="border-b-0">
      <Container className="flex flex-col gap-12">
        <SectionIntro eyebrow="FAQ" title="Questions principals ask first">
          What it costs, how setup works, and where your school&apos;s data
          lives. Something else on your mind? Write to us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </SectionIntro>
        <div className="flex flex-col gap-10">
          {GROUPS.map((group, i) => (
            <div
              key={group.title}
              className="grid gap-3 md:grid-cols-[14rem_1fr]"
            >
              <h3 className="pt-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {group.title}
              </h3>
              <Accordion
                defaultValue={i === 0 ? [group.items[0].q] : undefined}
                className="border-b"
              >
                {group.items.map((item) => (
                  <AccordionItem key={item.q} value={item.q}>
                    <AccordionTrigger className="cursor-pointer py-3.5 text-base transition-colors hover:text-primary hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="max-w-3xl text-base leading-relaxed text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
