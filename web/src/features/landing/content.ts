export const NAV_LINKS = [
  { label: "Why Kampasy", href: "/#why" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Modules", href: "/#modules" },
  { label: "Security", href: "/#security" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

/** How many modules the landing page shows before linking to `/modules`. */
export const FEATURED_MODULE_COUNT = 9;

export const HERO_POINTS = [
  "30-day free trial",
  "No card required",
  "Bangla & English",
] as const;

/** Product commitments from the PRD (principles and success metrics). */
export const KEY_METRICS = [
  { value: "< 24 h", label: "from sign-up to the first attendance taken" },
  { value: "≤ 3 days", label: "to publish results after the last exam" },
  { value: "360 px", label: "every core task works on a small phone" },
  { value: "100%", label: "of money and mark changes kept in the audit log" },
] as const;

/** Each row: the old way (PRD §1.1 problem statement) and what replaces it. */
export const WHY = [
  {
    id: "fees",
    before: "Fees taken over the counter, dues chased by phone",
    title: "Fees collected, not chased",
    description:
      "Invoices generate from your fee heads every month. Guardians pay by bKash, Nagad or card, receipts go out instantly, and reminders handle the dues.",
  },
  {
    id: "attendance",
    before: "Guardians find out about an absence days later",
    title: "Absentee alerts the same morning",
    description:
      "Teachers mark a whole section in seconds from a phone, even offline. Guardians hear about an absence before first period ends, not days later.",
  },
  {
    id: "results",
    before: "Results tabulated in Excel, report cards late",
    title: "Results in days, not weeks",
    description:
      "Marks entry, GPA tabulation and report cards in one flow, with your grading rules as settings instead of spreadsheet formulas.",
  },
  {
    id: "language",
    before: "English-only software and notices in Facebook groups",
    title: "Bangla and English, everywhere",
    description:
      "The interface, report cards, receipts and SMS all work in both languages, so every guardian reads in the one they prefer.",
  },
] as const;

export const PERSPECTIVES = [
  {
    id: "owners",
    label: "Owners & principals",
    title: "See the whole school from your phone",
    points: [
      "Enrolment, attendance and collection on one dashboard",
      "Approve results before they reach guardians",
      "Every financial and academic change in the audit trail",
    ],
    preview: [
      { label: "Collected this month", value: "৳8,42,500" },
      { label: "Outstanding dues", value: "৳1,12,000" },
      { label: "Staff present", value: "46 / 48" },
    ],
  },
  {
    id: "teachers",
    label: "Teachers",
    title: "Spend time teaching, not tallying",
    points: [
      "Mark the section present, then tap the absentees",
      "Enter marks for your subjects; grades calculate themselves",
      "Report-card remarks for your own section",
    ],
    preview: [
      { label: "Class 7 · Section B", value: "38 / 40 present" },
      { label: "Math · Half-yearly", value: "32 / 40 entered" },
      { label: "Leave requests", value: "2 waiting" },
    ],
  },
  {
    id: "accountants",
    label: "Accountants",
    title: "A ledger that reconciles itself",
    points: [
      "Fee heads per class, with waivers, fines and discounts",
      "Online and counter payments land in the same ledger",
      "Due reminders by SMS and email, receipts in two languages",
    ],
    preview: [
      { label: "Invoices for October", value: "1,248" },
      { label: "Paid online", value: "62%" },
      { label: "Reminders queued", value: "184" },
    ],
  },
  {
    id: "guardians",
    label: "Guardians",
    title: "Know how your child is doing, as it happens",
    points: [
      "An alert the morning your child is absent",
      "Results, report cards and notices as soon as they publish",
      "Pay fees online; one login covers every child",
    ],
    preview: [
      { label: "Ayaan · Class 7-B", value: "Present today" },
      { label: "Half-yearly result", value: "GPA 4.83" },
      { label: "October fee", value: "Paid" },
    ],
  },
] as const;

/** The core daily workflows (PRD §7), each from first tap to the guardian. */
export const HOW_IT_WORKS = [
  {
    id: "attendance",
    title: "Daily attendance",
    who: "Teacher → guardian",
    steps: [
      {
        title: "Mark the section",
        description:
          "Everyone starts present; the teacher taps the absentees on a phone, even offline.",
      },
      {
        title: "Saved and synced",
        description:
          "The register syncs as soon as there's signal, and the principal sees the school's total live.",
      },
      {
        title: "Guardians alerted",
        description:
          "Guardians of absent students get an SMS in Bangla the same morning.",
      },
    ],
  },
  {
    id: "fees",
    title: "Billing and fees",
    who: "Accountant → guardian",
    steps: [
      {
        title: "Invoices generate",
        description:
          "Each month's invoices are created from your fee heads, with waivers applied.",
      },
      {
        title: "Guardians pay",
        description:
          "By bKash, Nagad, card or at the counter, all into the same ledger.",
      },
      {
        title: "Receipts and reminders",
        description:
          "Receipts go out instantly; reminders follow up on whatever is still due.",
      },
    ],
  },
  {
    id: "results",
    title: "Exam results",
    who: "Teacher → principal → guardian",
    steps: [
      {
        title: "Enter marks",
        description:
          "Teachers enter marks for their own subjects; nothing to tabulate by hand.",
      },
      {
        title: "GPA calculates",
        description:
          "Grades, GPA 5.0 and merit positions are worked out by your grading rules.",
      },
      {
        title: "Approve and publish",
        description:
          "The principal approves, and report cards reach students and guardians.",
      },
    ],
  },
] as const;

/** One school day, moment by moment; each shows what the person actually sees. */
export const SCHOOL_DAY = {
  school: "Shapla Model School",
  moments: [
    {
      time: "7:50",
      role: "Class teacher",
      title: "Attendance is taken before the first bell",
      description:
        "The roster opens with everyone present. The teacher taps the two or three exceptions and saves. With a weak signal it saves on the phone and syncs later.",
      artifact: {
        kind: "note",
        strong: "Class 6 A saved.",
        text: "40 present, 1 absent, 1 late.",
      },
    },
    {
      time: "8:30",
      role: "Principal",
      title: "The principal sees who hasn't submitted",
      description:
        "Today's attendance by class, and the sections still waiting, without walking the corridors.",
      artifact: {
        kind: "list",
        heading: "4 of 38 sections not submitted",
        items: ["Class 3 B", "Class 7 A", "Class 9 C", "Class 10 B"],
      },
    },
    {
      time: "10:00",
      role: "Guardian",
      title: "Guardians hear about an absence the same morning",
      description:
        "One SMS per absent child, sent at the time the school chooses, in Bangla or English. If the child turns up and is marked present first, nothing is sent.",
      artifact: {
        kind: "sms",
        sender: "SHAPLA MODEL",
        text: "প্রিয় অভিভাবক, রাফি আহমেদ (৬ষ্ঠ ক, রোল ৭) আজ ১৯ অক্টোবর বিদ্যালয়ে অনুপস্থিত।",
      },
    },
    {
      time: "13:15",
      role: "Guardian",
      title: "A parent pays for two children in one go",
      description:
        "October tuition for both children, with the sibling discount already applied, paid with bKash. The receipt arrives at once and the dues update for the accountant.",
      artifact: {
        kind: "receipt",
        heading: "Receipt 004817, paid by bKash",
        lines: [
          { label: "Nusrat, Class 8 B", amount: "৳2,400" },
          { label: "Tanvir, Class 4 A", amount: "৳1,800" },
          { label: "Sibling discount", amount: "−৳180" },
        ],
        total: { label: "Paid", amount: "৳4,020" },
      },
    },
    {
      time: "17:00",
      role: "Owner",
      title: "The owner checks the day's collection",
      description:
        "Collected today, by channel and by collector, with what is still due. Every counter receipt is numbered in order, so the cash in the drawer has to match.",
      artifact: {
        kind: "collection",
        heading: "Collected today",
        total: "৳2,52,740",
        channels: [
          { label: "Counter", amount: "৳1,42,500", share: 56.4 },
          { label: "bKash", amount: "৳86,240", share: 34.1 },
          { label: "Bank", amount: "৳24,000", share: 9.5 },
        ],
      },
    },
  ],
} as const;

export type ModuleAvailability = "live" | "soon" | "roadmap";

export const MODULES: readonly {
  title: string;
  description: string;
  availability: ModuleAvailability;
}[] = [
  {
    title: "Academic setup",
    description:
      "Sessions, classes, sections, shifts and subjects. Classes stay; sections roll over each session.",
    availability: "live",
  },
  {
    title: "Student Information",
    description:
      "Profiles, guardians, documents, promotions and transfer certificates.",
    availability: "live",
  },
  {
    title: "Attendance",
    description:
      "Daily and period-wise attendance, leave requests and instant absentee alerts.",
    availability: "live",
  },
  {
    title: "Exams & Results",
    description:
      "Exam schedules, marks entry, GPA tabulation and printable report cards.",
    availability: "live",
  },
  {
    title: "Fees & Finance",
    description:
      "Fee structures, waivers, online payment, receipts and defaulter reports.",
    availability: "live",
  },
  {
    title: "Notices & SMS",
    description:
      "Notice board, email and Bangla SMS to a class, a section or everyone.",
    availability: "live",
  },
  {
    title: "Admissions",
    description: "Enquiries, online application forms and merit lists.",
    availability: "soon",
  },
  {
    title: "Timetable",
    description: "Clash-free class and teacher timetables with substitutions.",
    availability: "soon",
  },
  {
    title: "HR & Payroll",
    description: "Staff records, leave, salary structures and payslips.",
    availability: "soon",
  },
  {
    title: "Homework & LMS",
    description: "Assignments, submissions and study material.",
    availability: "soon",
  },
  {
    title: "Library & Transport",
    description: "Catalogue and issue/return; routes, vehicles and allocation.",
    availability: "soon",
  },
  {
    title: "Hostel & Inventory",
    description: "Rooms, mess and visitors; stock, purchases and assets.",
    availability: "roadmap",
  },
];

export const ONBOARDING_STEPS = [
  {
    title: "Sign up",
    description: "Create your school with your email or phone. No sales call.",
  },
  {
    title: "Set up your year",
    description: "Add classes, sections and subjects with guided templates.",
  },
  {
    title: "Import students",
    description:
      "Upload your Excel sheet. Guardians are invited automatically.",
  },
  {
    title: "Take attendance",
    description: "Teachers mark the first roll call — usually the same day.",
  },
] as const;

export const SECURITY_FEATURES = [
  {
    id: "isolation",
    title: "Strict data isolation",
    description:
      "Every school's data is separated at every layer. No one sees another school's records.",
  },
  {
    id: "audit",
    title: "Full audit trail",
    description: "Every fee, mark and grade change records who, what and when.",
  },
  {
    id: "backups",
    title: "Daily backups & export",
    description: "Your data is backed up and always exportable as CSV and PDF.",
  },
  {
    id: "consent",
    title: "Consent-based support",
    description:
      "Support can only access your account with time-boxed permission you grant.",
  },
] as const;

export type PricingPlan = {
  name: string;
  price: string;
  period?: string;
  audience: string;
  inherits?: string;
  features: readonly string[];
  cta: string;
  href: "signup" | "contact";
  featured?: boolean;
};

/** Facts every plan shares, shown above the plans. */
export const BILLING_FACTS = [
  { value: "Per student", label: "only active students are billed" },
  { value: "2 months free", label: "when you pay annually" },
  { value: "30 days", label: "free trial of Standard, no card" },
] as const;

export const ADD_ONS = [
  "Transport",
  "Hostel",
  "Homework & LMS",
  "AI features",
  "SMS credit bundles",
] as const;

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    name: "Free",
    price: "৳0",
    period: "forever",
    audience: "Up to 100 students",
    features: [
      "Student records",
      "Attendance",
      "Notices",
      "Basic results",
      "1 admin",
    ],
    cta: "Start free",
    href: "signup",
  },
  {
    name: "Basic",
    price: "Per active student",
    period: "monthly or annually",
    audience: "Small schools",
    inherits: "Everything in Free, plus",
    features: [
      "Fees & online payment",
      "Report cards",
      "Guardian portal",
      "SMS, pay as you go",
    ],
    cta: "Start 30-day trial",
    href: "signup",
  },
  {
    name: "Standard",
    price: "Per active student",
    period: "monthly or annually",
    audience: "Mid-size schools",
    inherits: "Everything in Basic, plus",
    features: [
      "HR & payroll",
      "Timetable",
      "Homework & LMS",
      "Library",
      "Custom roles",
      "Your own domain",
    ],
    cta: "Start 30-day trial",
    href: "signup",
    featured: true,
  },
  {
    name: "Premium",
    price: "Per active student",
    period: "monthly or annually",
    audience: "Large schools & groups",
    inherits: "Everything in Standard, plus",
    features: [
      "Transport & hostel",
      "Inventory",
      "Multi-branch",
      "Analytics & API",
      "Priority support",
    ],
    cta: "Talk to us",
    href: "contact",
  },
];

/** Grouped so people can skip to what they're deciding: setup vs day-to-day. */
export const FAQ_GROUPS = [
  {
    title: "Getting started",
    items: [
      {
        question: "How long is the free trial?",
        answer:
          "30 days of the Standard plan, no card required. When it ends, pick a paid plan, or stay on Free if you have up to 100 students.",
      },
      {
        question: "Can we import our existing records?",
        answer:
          "Yes. The setup wizard imports students, guardians and staff from an Excel sheet, so nothing gets typed twice.",
      },
      {
        question: "Does it work on mobile?",
        answer:
          "Every core task works on a 360 px phone screen. Kampasy installs to the home screen like an app, and attendance can be taken offline and synced later.",
      },
    ],
  },
  {
    title: "Running your school",
    items: [
      {
        question: "Does it support GPA 5.0 and our own grading?",
        answer:
          "GPA 5.0 is built in. Grading schemes, terms, shifts and report-card layouts are settings you control, not custom code.",
      },
      {
        question: "Can guardians pay fees with bKash or Nagad?",
        answer:
          "Yes. Guardians pay online by bKash, Nagad or card. Counter payments go into the same ledger, and every payment gets an instant receipt.",
      },
      {
        question:
          "Our teachers work at two schools. Do they need two accounts?",
        answer:
          "No. One account can belong to several schools, each with its own roles. People sign in on each school's address and only see that school's data.",
      },
      {
        question: "Who owns our data?",
        answer:
          "You do. Export everything as CSV or PDF at any time. If you leave, you keep a full export window and we delete your data with a certificate afterwards.",
      },
    ],
  },
] as const;
