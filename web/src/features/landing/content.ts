export const NAV_LINKS = [
  { label: "Modules", href: "#modules" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export const HERO_STATS = [
  { value: "14 hrs", label: "saved / teacher / month" },
  { value: "98%", label: "fee collection rate" },
  { value: "2 weeks", label: "to go live" },
] as const;

export const CUSTOMER_LOGOS = [
  "Greenfield Academy",
  "St. Mary's",
  "Oakridge Int'l",
  "Sunrise Group",
  "Little Scholars",
  "Delta College",
] as const;

export const PERSPECTIVES = [
  {
    id: "owners",
    label: "School owners",
    title: "See every campus, every rupee, in one place",
    points: [
      "Live revenue, dues and enrolment across branches",
      "Consolidated reports without chasing spreadsheets",
      "Role-based access for every member of staff",
    ],
  },
  {
    id: "principals",
    label: "Principals",
    title: "Run the day without firefighting",
    points: [
      "Attendance and absentee alerts before first period",
      "Exam schedules, results and report cards in one flow",
      "Circulars to any class, group or parent in seconds",
    ],
  },
  {
    id: "teachers",
    label: "Teachers",
    title: "Spend time teaching, not tallying",
    points: [
      "One-tap attendance from any phone",
      "Marks entry with auto-calculated grades",
      "Homework, lesson plans and class diaries",
    ],
  },
  {
    id: "parents",
    label: "Parents",
    title: "Know how your child is doing, as it happens",
    points: [
      "Check-in alerts, homework and results on the app",
      "Pay fees online and download receipts instantly",
      "Message teachers without waiting for PTM day",
    ],
  },
] as const;

export const MODULES = [
  {
    title: "Admissions",
    description:
      "Online applications, document upload, enquiry tracking and one-click enrolment.",
  },
  {
    title: "Student Information",
    description:
      "Complete profiles, guardians, medical notes, promotions and transfer certificates.",
  },
  {
    title: "Attendance",
    description:
      "Daily and period-wise attendance with instant SMS and app alerts to parents.",
  },
  {
    title: "Fees & Accounts",
    description:
      "Fee structures, discounts, online payments, receipts and defaulter reports.",
  },
  {
    title: "Exams & Results",
    description:
      "Exam schedules, marks entry, grading rules and printable report cards.",
  },
  {
    title: "Timetable",
    description:
      "Conflict-free class and teacher timetables with substitution management.",
  },
  {
    title: "HR & Payroll",
    description: "Staff records, leave, salary structures and payslips.",
  },
  {
    title: "Communication",
    description:
      "Notices, circulars, SMS, email and in-app messaging to any group.",
  },
  {
    title: "Reports & Analytics",
    description:
      "Ready-made and custom reports across academics, finance and operations.",
  },
] as const;

export const ONBOARDING_STEPS = [
  {
    title: "Book a demo",
    description:
      "A 30-minute walkthrough tailored to your school's size and structure.",
  },
  {
    title: "We migrate your data",
    description:
      "Our team imports students, staff and fee records from spreadsheets or your old system.",
  },
  {
    title: "Train & go live",
    description:
      "Role-wise training for admins and teachers. Most schools are live in two weeks.",
  },
] as const;

export const SECURITY_FEATURES = [
  {
    title: "Isolated tenants",
    description:
      "Each school's data is logically separated with its own subdomain and access rules.",
  },
  {
    title: "Role-based access",
    description:
      "Granular permissions for owners, admins, teachers, accountants and parents.",
  },
  {
    title: "Daily backups",
    description: "Encrypted, automated backups with point-in-time recovery.",
  },
  {
    title: "Audit trails",
    description:
      "Every change to marks, fees and records is logged and traceable.",
  },
] as const;

export type PricingPlan = {
  name: string;
  price: string;
  period?: string;
  audience: string;
  features: readonly string[];
  cta: string;
  featured?: boolean;
};

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    audience: "Up to 300 students",
    features: ["Students, attendance & fees", "Parent app", "Email support"],
    cta: "Start free trial",
  },
  {
    name: "Growth",
    price: "$129",
    period: "/mo",
    audience: "Up to 1,500 students",
    features: [
      "All Starter modules",
      "Exams, timetable & HR",
      "SMS gateway",
      "Priority support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    audience: "Multi-branch groups",
    features: [
      "Unlimited students",
      "Branch consolidation",
      "Dedicated success manager",
      "Custom integrations",
    ],
    cta: "Talk to sales",
  },
];

export const TESTIMONIAL = {
  quote:
    "Fee collection went from a month-long chase to a two-day process. Our teachers finally stopped living in spreadsheets.",
  author: "Nasrin Ahmed",
  role: "Principal, Greenfield Academy · 1,800 students",
} as const;

export const FAQS = [
  {
    question: "Can we migrate from our existing software?",
    answer:
      "Yes. Our team imports students, guardians, staff and fee history from spreadsheets or your current ERP as part of onboarding, at no extra cost.",
  },
  {
    question: "Does it work on mobile?",
    answer:
      "Kampasy works in any modern browser on phones, tablets and desktops, and parents and teachers get a dedicated mobile app.",
  },
  {
    question: "Can we manage multiple branches?",
    answer:
      "Yes. Each branch runs as its own school with its own staff and settings, and the Enterprise plan adds consolidated reporting across all of them.",
  },
  {
    question: "Who owns our data?",
    answer:
      "You do. You can export everything at any time, and if you leave we hand over a full export and delete your data on request.",
  },
] as const;
