import { Plus } from "lucide-react";
import { SITE } from "~/config/site";
import { Section, SectionHeading } from "../ui/section";

type Faq = { q: string; a: string };

const GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "How long does it take to get started?",
        a: "Most schools take their first attendance the day they sign up. A setup wizard walks you through your session, classes, sections, subjects and grading scale, then you invite teachers and import students.",
      },
      {
        q: "We keep our student list in Excel. Do we have to type it again?",
        a: "No. Fill our template with the list you already have and import it in one go. If your data is in another system, write to us and we'll help you move it.",
      },
      {
        q: "Do teachers need a computer?",
        a: "No. Attendance, marks entry and notices are designed for a phone and work on a small screen. The office can use a computer for bigger jobs like fee collection and printing report cards.",
      },
    ],
  },
  {
    title: "Plans & billing",
    items: [
      {
        q: "How does pricing work?",
        a: "Paid plans are priced per active student per month, in taka, so you only pay for the students you have. Yearly billing gets two months free. Every school starts with 30 days of Standard without a card.",
      },
      {
        q: "Is the Free plan really free?",
        a: "Yes, for schools with up to 100 students. It includes student records, attendance, notices and basic results, with one school admin. When you grow past that, move to a paid plan and keep all your data.",
      },
      {
        q: "Can guardians pay fees online?",
        a: "Not yet. Today the accountant collects at the counter, and Kampasy issues numbered receipts and keeps dues up to date. Online payment with bKash and cards is on the way.",
      },
    ],
  },
  {
    title: "Bangla & grading",
    items: [
      {
        q: "Is it available in Bangla?",
        a: "Yes. Each person chooses Bangla or English. Bangla screens use Bangla numerals, amounts are shown in lakhs, and report cards and receipts print in either language.",
      },
      {
        q: "We follow Cambridge, or we are a madrasa. Will the grading fit?",
        a: "Yes. GPA 5.0 is the default, and the grading scale is a school setting, so you can use GPA 4.0, Cambridge grades, percentages or a madrasa scheme instead.",
      },
    ],
  },
  {
    title: "Your school's data",
    items: [
      {
        q: "Is our school's data separate from other schools?",
        a: `Yes. Your school has its own workspace and address (yourschool.${SITE.rootDomain}), its own settings and its own data. Every record is tied to one school and checked by the application and the database, so no other school can see it.`,
      },
      {
        q: "Can we use our own domain?",
        a: "Yes, on Standard and Premium. Point an address like erp.yourschool.edu.bd at Kampasy and your staff, students and guardians sign in there. Your school's subdomain keeps working too.",
      },
      {
        q: "Who can see what?",
        a: "Roles decide it. Teachers see their own classes, accountants see fees, and guardians see only their own children. Your school admin assigns roles and can adjust them.",
      },
    ],
  },
];

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-title">
      <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions principals ask first">
        What it costs, how setup works, and where your school&apos;s data lives. Something else on
        your mind? Write to us at{" "}
        <a className="font-semibold text-ink underline-offset-4 hover:underline" href={`mailto:${SITE.email}`}>
          {SITE.email}
        </a>
        .
      </SectionHeading>

      <div className="mt-12 space-y-8">
        {GROUPS.map((group, g) => (
          <div key={group.title} className="grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
            <h3 className="text-xs font-semibold tracking-[0.18em] text-ink-3 uppercase md:pt-3.5">
              {group.title}
            </h3>
            <div className="border-t border-line md:border-t-0">
              {group.items.map((item, i) => (
                <details
                  key={item.q}
                  open={g === 0 && i === 0}
                  className="group border-b border-line"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-6 py-3 text-base font-medium transition-colors hover:text-forest-2">
                    {item.q}
                    <Plus
                      className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="-mt-0.5 max-w-2xl pb-4 text-[15px] leading-relaxed text-ink-2">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
