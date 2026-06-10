import type { NavCategory } from "~/app/(dashboard)/_components/nav-main"
import {
  LayoutDashboard,
  LineChart,
  FileBarChart,
  ClipboardList,
  Award,
  Users,
  UsersRound,
  Briefcase,
  Wallet,
  Bus,
  Library,
  Hotel,
  Package,
  UtensilsCrossed,
  ShieldCheck,
  CalendarRange,
  Megaphone,
  HeartHandshake,
  Building2,
  Shield,
  Settings,
  Plug,
  CircleHelp,
  Ticket,
  Sparkles,
  Settings2,
  User,
  School,
  BookOpen,
  BookMarked,
  GraduationCap,
  Banknote,
  SlidersHorizontal,
  Download,
  UserPlus,
  FileText,
  UserCheck,
  FileCheck,
  ListOrdered,
  Medal,
  Layers,
  NotebookPen,
  CalendarClock,
  PenLine,
  Video,
  FolderOpen,
  ClipboardCheck,
  Plane,
  Calendar,
  ChartNoAxesColumn,
  FileBadge,
  ScrollText,
  Send,
  PlusCircle,
  Inbox,
  NotebookTabs,
  BookUser,
  UserCircle2,
  ShieldAlert,
  HeartPulse,
  IdCard,
  ArrowRightLeft,
  KeyRound,
  CalendarDays,
  FileSignature,
  Building,
  ContactRound,
  Percent,
  Receipt,
  CreditCard,
  CircleDollarSign,
  Undo2,
  PieChart,
  PartyPopper,
  Palmtree,
  Truck,
  Route,
  MapPin,
  Coins,
  BookCopy,
  Tags,
  ArrowLeftRight,
  DoorOpen,
  Box,
  Boxes,
  ShoppingCart,
  MessageSquare,
  Mail,
  Smartphone,
  Bell,
  Workflow,
  FormInput,
  LayoutTemplate,
  Database,
  Link2,
} from "lucide-react"

/**
 * Category → menu → submenu (aligned with product IA).
 * Routes resolve via `/dashboard/[...slug]` until feature pages exist.
 */
export const sidebarNavCategories: NavCategory[] = [
  {
    label: "Dashboard",
    accentDot: "bg-violet-500",
    menus: [
      {
        title: "Overview",
        url: "/dashboard/overview",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        title: "Analytics",
        url: "/dashboard/analytics",
        icon: LineChart,
      },
      {
        title: "Reports",
        url: "/dashboard/reports/academic",
        icon: FileBarChart,
        items: [
          {
            title: "Academic Reports",
            url: "/dashboard/reports/academic",
            icon: GraduationCap,
          },
          {
            title: "Attendance Reports",
            url: "/dashboard/reports/attendance",
            icon: ClipboardList,
          },
          {
            title: "Finance Reports",
            url: "/dashboard/reports/finance",
            icon: Banknote,
          },
          {
            title: "HR Reports",
            url: "/dashboard/reports/hr",
            icon: Users,
          },
          {
            title: "Transport Reports",
            url: "/dashboard/reports/transport",
            icon: Bus,
          },
          {
            title: "Custom Reports",
            url: "/dashboard/reports/custom",
            icon: SlidersHorizontal,
          },
          {
            title: "Data Export",
            url: "/dashboard/reports/data-export",
            icon: Download,
          },
        ],
      },
    ],
  },
  {
    label: "Academics",
    accentDot: "bg-emerald-500",
    menus: [
      {
        title: "Admissions",
        url: "/dashboard/academics/admissions/inquiries",
        icon: School,
        items: [
          {
            title: "Inquiries / Leads",
            url: "/dashboard/academics/admissions/inquiries",
            icon: UserPlus,
          },
          {
            title: "Applications",
            url: "/dashboard/academics/admissions/applications",
            icon: FileText,
          },
          {
            title: "Enrollment",
            url: "/dashboard/academics/admissions/enrollment",
            icon: UserCheck,
          },
          {
            title: "Document Verification",
            url: "/dashboard/academics/admissions/document-verification",
            icon: FileCheck,
          },
          {
            title: "Waiting List",
            url: "/dashboard/academics/admissions/waiting-list",
            icon: ListOrdered,
          },
          {
            title: "Scholarship Applications",
            url: "/dashboard/academics/admissions/scholarships",
            icon: Medal,
          },
        ],
      },
      {
        title: "Programs & teaching",
        url: "/dashboard/academics/classes",
        icon: BookOpen,
        items: [
          {
            title: "Classes / Sections",
            url: "/dashboard/academics/classes",
            icon: Layers,
          },
          { title: "Subjects", url: "/dashboard/academics/subjects", icon: BookOpen },
          { title: "Curriculum", url: "/dashboard/academics/curriculum", icon: BookMarked },
          {
            title: "Lesson Plans",
            url: "/dashboard/academics/lesson-plans",
            icon: NotebookPen,
          },
          { title: "Timetable", url: "/dashboard/academics/timetable", icon: CalendarClock },
          {
            title: "Homework",
            url: "/dashboard/academics/homework",
            icon: PenLine,
          },
          {
            title: "Online Classes",
            url: "/dashboard/academics/online-classes",
            icon: Video,
          },
          {
            title: "Study Materials",
            url: "/dashboard/academics/study-materials",
            icon: FolderOpen,
          },
        ],
      },
      {
        title: "Attendance",
        url: "/dashboard/academics/attendance",
        icon: ClipboardList,
        items: [
          {
            title: "Mark attendance",
            url: "/dashboard/academics/attendance/mark",
            icon: ClipboardCheck,
          },
          {
            title: "Attendance reports",
            url: "/dashboard/academics/attendance/reports",
            icon: FileBarChart,
          },
          {
            title: "Leave requests",
            url: "/dashboard/academics/attendance/leave-requests",
            icon: Plane,
          },
        ],
      },
      {
        title: "Examinations",
        url: "/dashboard/academics/exams",
        icon: Award,
        items: [
          {
            title: "Exam schedule",
            url: "/dashboard/academics/exams/schedule",
            icon: Calendar,
          },
          {
            title: "Marks Entry",
            url: "/dashboard/academics/exams/marks-entry",
            icon: PenLine,
          },
          {
            title: "Grades & GPA",
            url: "/dashboard/academics/exams/grades-gpa",
            icon: ChartNoAxesColumn,
          },
          {
            title: "Report Cards",
            url: "/dashboard/academics/exams/report-cards",
            icon: FileBadge,
          },
          {
            title: "Transcripts",
            url: "/dashboard/academics/exams/transcripts",
            icon: ScrollText,
          },
          {
            title: "Result Publish",
            url: "/dashboard/academics/exams/result-publish",
            icon: Send,
          },
          {
            title: "Certificates",
            url: "/dashboard/academics/exams/certificates",
            icon: Award,
          },
        ],
      },
      {
        title: "Assignments",
        url: "/dashboard/academics/assignments",
        icon: BookMarked,
        items: [
          {
            title: "Create assignment",
            url: "/dashboard/academics/assignments/create",
            icon: PlusCircle,
          },
          {
            title: "Submissions",
            url: "/dashboard/academics/assignments/submissions",
            icon: Inbox,
          },
          {
            title: "Gradebook",
            url: "/dashboard/academics/assignments/gradebook",
            icon: NotebookTabs,
          },
        ],
      },
    ],
  },
  {
    label: "People",
    accentDot: "bg-blue-500",
    menus: [
      {
        title: "Students",
        url: "/dashboard/people/students",
        icon: Users,
        items: [
          {
            title: "Student Directory",
            url: "/dashboard/people/students",
            icon: BookUser,
          },
          {
            title: "Admission Records",
            url: "/dashboard/people/students/admission-records",
            icon: FileText,
          },
          {
            title: "Student Profiles",
            url: "/dashboard/people/students/profiles",
            icon: UserCircle2,
          },
          {
            title: "Attendance",
            url: "/dashboard/people/students/attendance",
            icon: ClipboardCheck,
          },
          {
            title: "Discipline / Behavior",
            url: "/dashboard/people/students/discipline",
            icon: ShieldAlert,
          },
          {
            title: "Health Records",
            url: "/dashboard/people/students/health-records",
            icon: HeartPulse,
          },
          {
            title: "ID Cards",
            url: "/dashboard/people/students/id-cards",
            icon: IdCard,
          },
          {
            title: "Promotions / Transfers",
            url: "/dashboard/people/students/promotions-transfers",
            icon: ArrowRightLeft,
          },
          {
            title: "Alumni",
            url: "/dashboard/people/students/alumni",
            icon: GraduationCap,
          },
        ],
      },
      {
        title: "Parents",
        url: "/dashboard/people/parents",
        icon: UsersRound,
        items: [
          {
            title: "Parent directory",
            url: "/dashboard/people/parents",
            icon: BookUser,
          },
          {
            title: "Parent portal access",
            url: "/dashboard/people/parents/portal",
            icon: KeyRound,
          },
          {
            title: "Parent Meetings",
            url: "/dashboard/people/parents/meetings",
            icon: CalendarDays,
          },
          {
            title: "Consent Forms",
            url: "/dashboard/people/parents/consent-forms",
            icon: FileSignature,
          },
        ],
      },
      {
        title: "Staff & HR",
        url: "/dashboard/people/staff",
        icon: Briefcase,
        items: [
          {
            title: "Staff Directory",
            url: "/dashboard/people/staff",
            icon: ContactRound,
          },
          {
            title: "Teachers",
            url: "/dashboard/people/teachers",
            icon: GraduationCap,
          },
          {
            title: "Departments",
            url: "/dashboard/people/staff/departments",
            icon: Building,
          },
          {
            title: "Designations",
            url: "/dashboard/people/staff/designations",
            icon: Award,
          },
          {
            title: "Attendance",
            url: "/dashboard/people/staff/attendance",
            icon: ClipboardList,
          },
          {
            title: "Leave Management",
            url: "/dashboard/people/staff/leave",
            icon: Plane,
          },
          {
            title: "Payroll",
            url: "/dashboard/people/staff/payroll",
            icon: Wallet,
          },
          {
            title: "Performance Reviews",
            url: "/dashboard/people/staff/performance-reviews",
            icon: LineChart,
          },
          {
            title: "Recruitment",
            url: "/dashboard/people/staff/recruitment",
            icon: UserPlus,
          },
        ],
      },
    ],
  },
  {
    label: "Operations",
    accentDot: "bg-orange-500",
    menus: [
      {
        title: "Finance",
        url: "/dashboard/operations/finance",
        icon: Wallet,
        // Admins/isAdmin see all; otherwise restricted to finance staff.
        roles: ["accountant"],
        items: [
          {
            title: "Fee Structure",
            url: "/dashboard/operations/finance/fee-structure",
            icon: ListOrdered,
          },
          {
            title: "Discounts / Waivers",
            url: "/dashboard/operations/finance/discounts-waivers",
            icon: Percent,
          },
          {
            title: "Scholarships",
            url: "/dashboard/operations/finance/scholarships",
            icon: Award,
          },
          {
            title: "Invoices",
            url: "/dashboard/operations/finance/invoices",
            icon: FileText,
          },
          {
            title: "Payments",
            url: "/dashboard/operations/finance/payments",
            icon: CreditCard,
          },
          {
            title: "Due Collection",
            url: "/dashboard/operations/finance/due-collection",
            icon: CircleDollarSign,
          },
          {
            title: "Refunds",
            url: "/dashboard/operations/finance/refunds",
            icon: Undo2,
          },
          {
            title: "Expense Management",
            url: "/dashboard/operations/finance/expense-management",
            icon: Receipt,
          },
          {
            title: "Budgeting",
            url: "/dashboard/operations/finance/budgeting",
            icon: PieChart,
          },
          {
            title: "Accounting Ledger",
            url: "/dashboard/operations/finance/accounting-ledger",
            icon: BookOpen,
          },
          {
            title: "Financial Reports",
            url: "/dashboard/operations/finance/financial-reports",
            icon: FileBarChart,
          },
        ],
      },
      {
        title: "Events",
        url: "/dashboard/operations/events/calendar",
        icon: CalendarRange,
        items: [
          {
            title: "Calendar",
            url: "/dashboard/operations/events/calendar",
            icon: Calendar,
          },

          {
            title: "School events",
            url: "/dashboard/operations/events/school",
            icon: PartyPopper,
          },
          {
            title: "Holidays",
            url: "/dashboard/operations/events/holidays",
            icon: Palmtree,
          },
        ],
      },
    ],
  },
  {
    label: "Campus Services",
    accentDot: "bg-cyan-500",
    menus: [
      {
        title: "Transport",
        url: "/dashboard/operations/campus/transport",
        icon: Bus,
        items: [
          {
            title: "Vehicles",
            url: "/dashboard/operations/campus/transport/vehicles",
            icon: Truck,
          },
          {
            title: "Routes",
            url: "/dashboard/operations/campus/transport/routes",
            icon: Route,
          },
          {
            title: "Stops",
            url: "/dashboard/operations/campus/transport/stops",
            icon: MapPin,
          },
          {
            title: "Transport Fees",
            url: "/dashboard/operations/campus/transport/fees",
            icon: Coins,
          },
        ],
      },
      {
        title: "Library",
        url: "/dashboard/operations/campus/library/books",
        icon: Library,
        // Admins/isAdmin see all; otherwise restricted to library staff.
        roles: ["librarian"],
        items: [
          {
            title: "Books",
            url: "/dashboard/operations/campus/library/books",
            icon: BookCopy,
          },
          {
            title: "Categories",
            url: "/dashboard/operations/campus/library/categories",
            icon: Tags,
          },
          {
            title: "Issue / Return",
            url: "/dashboard/operations/campus/library/issue-return",
            icon: ArrowLeftRight,
          },
          {
            title: "Fines",
            url: "/dashboard/operations/campus/library/fines",
            icon: Coins,
          },
        ],
      },
      {
        title: "Hostel",
        url: "/dashboard/operations/campus/hostel/rooms",
        icon: Hotel,
        items: [
          {
            title: "Rooms",
            url: "/dashboard/operations/campus/hostel/rooms",
            icon: DoorOpen,
          },
          {
            title: "Allocations",
            url: "/dashboard/operations/campus/hostel/allocations",
            icon: Users,
          },
          {
            title: "Hostel Fees",
            url: "/dashboard/operations/campus/hostel/fees",
            icon: Wallet,
          },
        ],
      },
      {
        title: "Inventory",
        url: "/dashboard/operations/campus/inventory/assets",
        icon: Package,
        items: [
          {
            title: "Assets",
            url: "/dashboard/operations/campus/inventory/assets",
            icon: Box,
          },
          {
            title: "Stock Items",
            url: "/dashboard/operations/campus/inventory/stock-items",
            icon: Boxes,
          },
          {
            title: "Purchase Orders",
            url: "/dashboard/operations/campus/inventory/purchase-orders",
            icon: ShoppingCart,
          },
          {
            title: "Suppliers",
            url: "/dashboard/operations/campus/inventory/suppliers",
            icon: Truck,
          },
        ],
      },
      {
        title: "Cafeteria",
        url: "/dashboard/operations/campus/cafeteria",
        icon: UtensilsCrossed,
      },
      {
        title: "Security / Gate Pass",
        url: "/dashboard/operations/campus/security-gate-pass",
        icon: ShieldCheck,
      },
    ],
  },
  {
    label: "Communication",
    accentDot: "bg-yellow-500",
    menus: [
      {
        title: "Outreach",
        url: "/dashboard/communication/outreach/announcements",
        icon: Megaphone,
        items: [
          {
            title: "Announcements",
            url: "/dashboard/communication/outreach/announcements",
            icon: Megaphone,
          },
          {
            title: "Messages",
            url: "/dashboard/communication/outreach/messages",
            icon: MessageSquare,
          },
          {
            title: "Email Campaigns",
            url: "/dashboard/communication/outreach/email-campaigns",
            icon: Mail,
          },
          {
            title: "SMS / WhatsApp",
            url: "/dashboard/communication/outreach/alerts",
            icon: Smartphone,
          },
          {
            title: "Push Notifications",
            url: "/dashboard/communication/outreach/push-notifications",
            icon: Bell,
          },
          {
            title: "Notice board",
            url: "/dashboard/communication/outreach/notice-board",
            icon: ClipboardList,
          },
          {
            title: "Outreach / CRM",
            url: "/dashboard/communication/outreach/outreach-crm",
            icon: Users,
          },
        ],
      },
      {
        title: "Parent engagement",
        url: "/dashboard/communication/parent-engagement/meetings",
        icon: HeartHandshake,
        items: [
          {
            title: "Parent meetings",
            url: "/dashboard/communication/parent-engagement/meetings",
            icon: UsersRound,
          },
          {
            title: "Progress sharing",
            url: "/dashboard/communication/parent-engagement/progress",
            icon: LineChart,
          },
        ],
      },
    ],
  },
  {
    label: "Administration",
    accentDot: "bg-zinc-400",
    // School setup, users & access, integrations, system — admins only.
    roles: ["admin"],
    menus: [
      {
        title: "School setup",
        url: "/dashboard/admin/school-setup/profile",
        icon: Building2,
        items: [
          {
            title: "Schools / Branches",
            url: "/dashboard/admin/schools-branches",
            icon: Building2,
          },
          {
            title: "School profile",
            url: "/dashboard/admin/school-setup/profile",
            icon: School,
          },
          {
            title: "Academic Years",
            url: "/dashboard/admin/school-setup/academic-years",
            icon: CalendarRange,
          },
          {
            title: "Terms / Semesters",
            url: "/dashboard/admin/school-setup/terms-semesters",
            icon: CalendarClock,
          },
          {
            title: "Departments",
            url: "/dashboard/admin/school-setup/departments",
            icon: Building,
          },
          {
            title: "Branches",
            url: "/dashboard/admin/school-setup/branches",
            icon: Layers,
          },
        ],
      },
      {
        title: "Users & access",
        url: "/dashboard/admin/users-access/users",
        icon: Shield,
        items: [
          {
            title: "User management",
            url: "/dashboard/admin/users-access/users",
            icon: Users,
          },
          {
            title: "Roles & permissions",
            url: "/dashboard/admin/users-access/roles",
            icon: Shield,
          },
          {
            title: "Audit logs",
            url: "/dashboard/admin/users-access/audit-logs",
            icon: ScrollText,
          },
        ],
      },
      {
        title: "Integrations",
        url: "/dashboard/admin/integrations/payment-gateways",
        icon: Plug,
        items: [
          {
            title: "Payment Gateways",
            url: "/dashboard/admin/integrations/payment-gateways",
            icon: CreditCard,
          },
          {
            title: "SMS Providers",
            url: "/dashboard/admin/integrations/sms-providers",
            icon: Smartphone,
          },
          {
            title: "Email Providers",
            url: "/dashboard/admin/integrations/email-providers",
            icon: Mail,
          },
          {
            title: "Video Conferencing",
            url: "/dashboard/admin/integrations/video-conferencing",
            icon: Video,
          },
          {
            title: "LMS Integrations",
            url: "/dashboard/admin/integrations/lms",
            icon: Link2,
          },
          {
            title: "API Keys / Webhooks",
            url: "/dashboard/admin/integrations/api-keys-webhooks",
            icon: KeyRound,
          },
        ],
      },
      {
        title: "System",
        url: "/dashboard/admin/workflow-automation",
        icon: Settings,
        items: [
          {
            title: "Workflow Automation",
            url: "/dashboard/admin/workflow-automation",
            icon: Workflow,
          },
          {
            title: "Custom Fields",
            url: "/dashboard/admin/custom-fields",
            icon: FormInput,
          },
          {
            title: "Templates",
            url: "/dashboard/admin/templates",
            icon: LayoutTemplate,
          },
          {
            title: "Backup & Restore",
            url: "/dashboard/admin/system/backup",
            icon: Database,
          },
          {
            title: "Subscription / Billing",
            url: "/dashboard/admin/subscription-billing",
            icon: CreditCard,
          },
          {
            title: "System Settings",
            url: "/dashboard/admin/system/settings",
            icon: Settings,
          },
        ],
      },
    ],
  },
  {
    label: "Support",
    accentDot: "bg-sky-500",
    menus: [
      {
        title: "Help Center",
        url: "/dashboard/support/help-center",
        icon: CircleHelp,
      },
      {
        title: "Tickets",
        url: "/dashboard/support/tickets",
        icon: Ticket,
      },
      {
        title: "Product Updates",
        url: "/dashboard/support/product-updates",
        icon: Sparkles,
      },
    ],
  },
]

export const sidebarSecondaryNav = [
  {
    title: "Profile",
    url: "/profile",
    icon: <User className="size-4" />,
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: <Settings2 className="size-4" />,
  },
]
