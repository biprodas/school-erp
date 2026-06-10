import {
  Award,
  BookMarked,
  BookOpen,
  Building2,
  Bus,
  Calendar,
  CalendarClock,
  CalendarRange,
  ChartNoAxesColumn,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileBadge,
  FileText,
  FolderOpen,
  Hotel,
  IdCard,
  LayoutDashboard,
  Library,
  LineChart,
  ListOrdered,
  Medal,
  Megaphone,
  MessageSquare,
  PenLine,
  Receipt,
  ScrollText,
  UtensilsCrossed,
  Video,
  Wallet,
} from "lucide-react"

import type { NavMenuEntry } from "~/lib/sidebar-nav"

/**
 * The student portal navigation. HARD CAP: at most 6 top-level hubs. Every
 * current and future student-facing feature must live as a sub-item under one
 * of these hubs — never add a 7th top-level entry.
 *
 * Where does a new feature go?
 *   • learn / do in class  → Academics
 *   • graded / credential  → Exams
 *   • money                → Finance
 *   • physical campus service → Campus
 *   • pushed *to* the student → Notices
 *
 * Sub-routes resolve via the `student/[...slug]` catch-all placeholder until
 * real pages exist. Profile/Account live in the header avatar menu, not here.
 */
export const studentNav: NavMenuEntry[] = [
  {
    title: "Home",
    url: "/student/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Academics",
    url: "/student/academics",
    icon: BookOpen,
    items: [
      { title: "Timetable", url: "/student/academics/timetable", icon: CalendarClock },
      { title: "Attendance", url: "/student/academics/attendance", icon: ClipboardCheck },
      { title: "Homework & Assignments", url: "/student/academics/homework", icon: PenLine },
      { title: "Study Materials", url: "/student/academics/materials", icon: FolderOpen },
      { title: "Online Classes", url: "/student/academics/online-classes", icon: Video },
      { title: "Subjects", url: "/student/academics/subjects", icon: BookMarked },
    ],
  },
  {
    title: "Exams",
    url: "/student/exams",
    icon: Award,
    items: [
      { title: "Exam Schedule", url: "/student/exams/schedule", icon: Calendar },
      { title: "Admit Cards", url: "/student/exams/admit-cards", icon: FileBadge },
      { title: "Results", url: "/student/exams/results", icon: ChartNoAxesColumn },
      { title: "Report Cards", url: "/student/exams/report-cards", icon: FileText },
      { title: "Transcripts", url: "/student/exams/transcripts", icon: ScrollText },
      { title: "Certificates", url: "/student/exams/certificates", icon: Award },
    ],
  },
  {
    title: "Finance",
    url: "/student/finance",
    icon: Wallet,
    items: [
      { title: "Fee Structure", url: "/student/finance/fee-structure", icon: ListOrdered },
      { title: "Invoices", url: "/student/finance/invoices", icon: FileText },
      { title: "Pay Online", url: "/student/finance/pay", icon: CreditCard },
      { title: "Dues", url: "/student/finance/dues", icon: CircleDollarSign },
      { title: "Receipts", url: "/student/finance/receipts", icon: Receipt },
      { title: "Scholarships", url: "/student/finance/scholarships", icon: Medal },
    ],
  },
  {
    title: "Campus",
    url: "/student/campus",
    icon: Building2,
    items: [
      { title: "Library", url: "/student/campus/library", icon: Library },
      { title: "Transport", url: "/student/campus/transport", icon: Bus },
      { title: "Hostel", url: "/student/campus/hostel", icon: Hotel },
      { title: "Cafeteria", url: "/student/campus/cafeteria", icon: UtensilsCrossed },
      { title: "ID & Gate Pass", url: "/student/campus/id-gate-pass", icon: IdCard },
    ],
  },
  {
    title: "Notices",
    url: "/student/notices",
    icon: Megaphone,
    items: [
      { title: "Announcements", url: "/student/notices/announcements", icon: Megaphone },
      { title: "Messages", url: "/student/notices/messages", icon: MessageSquare },
      { title: "Calendar & Events", url: "/student/notices/calendar", icon: CalendarRange },
      { title: "Progress", url: "/student/notices/progress", icon: LineChart },
    ],
  },
]
