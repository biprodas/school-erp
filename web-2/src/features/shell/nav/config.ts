import {
  BanknoteIcon,
  BookOpenIcon,
  BriefcaseBusinessIcon,
  CalendarCheckIcon,
  ClipboardListIcon,
  HeartHandshakeIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  ReceiptIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import type messages from "../../../../messages/en.json"
import type { Requirement } from "~/features/access/permissions"

/** A label under `nav.labels` in the message catalogs. */
export type NavLabel = keyof (typeof messages)["nav"]["labels"]
export type NavCategoryLabel = keyof (typeof messages)["nav"]["categories"]

export interface NavItem extends Requirement {
  id: NavLabel
  href: string
  /** Active only on this exact path, not below it. */
  exact?: boolean
}

/** A sidebar entry: a link of its own (`href`) or a group of `items`. */
export interface NavMenu extends Requirement {
  id: NavLabel
  icon: LucideIcon
  href?: string
  exact?: boolean
  items?: NavItem[]
}

export interface NavCategory {
  id: NavCategoryLabel
  menus: NavMenu[]
}

/**
 * The staff sidebar (doc/frontend-implementation-plan.md 5.4), trimmed to
 * what the MVP backend covers. Items name the permission key
 * (`backend/src/modules/rbac/permissions.catalog.ts`) of the endpoint
 * behind the screen, never a role: custom roles make role names wrong.
 * A screen that isn't built yet opens "Coming soon"
 * (`app/school/dashboard/[...slug]`).
 */
export const NAV: NavCategory[] = [
  {
    id: "overview",
    menus: [
      {
        id: "dashboard",
        icon: LayoutDashboardIcon,
        href: "/dashboard",
        exact: true,
      },
    ],
  },
  {
    id: "academics",
    menus: [
      {
        id: "academicSetup",
        icon: BookOpenIcon,
        items: [
          {
            id: "sessions",
            href: "/dashboard/academics/sessions",
            permission: "academic_years:read",
          },
          {
            id: "classes",
            href: "/dashboard/academics/classes",
            permission: "classes:read",
          },
          {
            id: "subjects",
            href: "/dashboard/academics/subjects",
            permission: "subjects:read",
          },
          {
            id: "curriculum",
            href: "/dashboard/academics/curriculum",
            permission: "class_subjects:read",
          },
          {
            id: "teacherAssignments",
            href: "/dashboard/academics/teachers",
            permission: ["class_teachers:read", "subject_teachers:read"],
          },
          {
            id: "shiftsRooms",
            href: "/dashboard/academics/shifts-rooms",
            permission: ["shifts:read", "rooms:read"],
          },
        ],
      },
      {
        id: "attendance",
        icon: CalendarCheckIcon,
        items: [
          {
            id: "takeAttendance",
            href: "/dashboard/attendance/take",
            permission: "attendance:take",
          },
          {
            id: "registers",
            href: "/dashboard/attendance/registers",
            permission: "attendance:read",
          },
          {
            id: "leaveRequests",
            href: "/dashboard/attendance/leaves",
            permission: "student_leaves:read",
          },
          {
            id: "holidays",
            href: "/dashboard/attendance/holidays",
            permission: "holidays:read",
          },
        ],
      },
      {
        id: "exams",
        icon: ClipboardListIcon,
        items: [
          {
            id: "examList",
            href: "/dashboard/exams",
            permission: "exams:read",
          },
          {
            id: "markEntry",
            href: "/dashboard/exams/marks",
            permission: "results:enter",
          },
          {
            id: "results",
            href: "/dashboard/exams/results",
            permission: "results:read",
          },
          {
            id: "reportCards",
            href: "/dashboard/exams/report-cards",
            permission: "report_cards:print",
          },
          {
            id: "grading",
            href: "/dashboard/exams/grading",
            permission: "grading_systems:read",
          },
        ],
      },
    ],
  },
  {
    id: "people",
    menus: [
      {
        id: "students",
        icon: UsersIcon,
        items: [
          {
            id: "studentDirectory",
            href: "/dashboard/students",
            permission: "students:read",
          },
          {
            id: "admitStudent",
            href: "/dashboard/students/new",
            permission: "students:create",
          },
          {
            id: "importStudents",
            href: "/dashboard/students/import",
            permission: "students:import",
          },
          {
            id: "promotions",
            href: "/dashboard/students/promotions",
            permission: "promotions:read",
          },
          {
            id: "idCards",
            href: "/dashboard/students/id-cards",
            permission: "id_cards:print",
          },
          {
            id: "certificates",
            href: "/dashboard/students/certificates",
            permission: "certificates:read",
          },
        ],
      },
      {
        id: "guardians",
        icon: HeartHandshakeIcon,
        href: "/dashboard/guardians",
        permission: "guardians:read",
      },
      {
        id: "staff",
        icon: BriefcaseBusinessIcon,
        items: [
          {
            id: "staffDirectory",
            href: "/dashboard/staff",
            permission: "employees:read",
          },
          {
            id: "departments",
            href: "/dashboard/staff/departments",
            permission: "departments:read",
          },
          {
            id: "designations",
            href: "/dashboard/staff/designations",
            permission: "designations:read",
          },
        ],
      },
    ],
  },
  {
    id: "finance",
    menus: [
      {
        id: "fees",
        icon: BanknoteIcon,
        items: [
          {
            id: "collectFees",
            href: "/dashboard/fees/collect",
            permission: "fees:collect",
          },
          {
            id: "invoices",
            href: "/dashboard/fees/invoices",
            permission: "fees:read",
          },
          {
            id: "payments",
            href: "/dashboard/fees/payments",
            permission: "fees:read",
          },
          {
            id: "feeSetup",
            href: "/dashboard/fees/setup",
            permission: "fees:setup",
          },
          {
            id: "approvals",
            href: "/dashboard/fees/approvals",
            permission: "fees:approve_waiver",
          },
        ],
      },
      {
        id: "expenses",
        icon: ReceiptIcon,
        href: "/dashboard/expenses",
        permission: "expenses:manage",
      },
      {
        id: "ledger",
        icon: LandmarkIcon,
        href: "/dashboard/ledger",
        permission: "ledger:read",
      },
    ],
  },
  {
    id: "communication",
    menus: [
      {
        id: "notices",
        icon: MegaphoneIcon,
        href: "/dashboard/notices",
        permission: "notices:read",
      },
      {
        id: "communication",
        icon: MessagesSquareIcon,
        items: [
          {
            id: "communicationLog",
            href: "/dashboard/communication/log",
            permission: "communication:read",
          },
          {
            id: "notificationTemplates",
            href: "/dashboard/communication/templates",
            permission: "communication:manage",
          },
        ],
      },
    ],
  },
  {
    id: "administration",
    menus: [
      {
        id: "usersAccess",
        icon: ShieldCheckIcon,
        items: [
          {
            id: "users",
            href: "/dashboard/admin/users",
            permission: "users:read",
          },
          {
            id: "roles",
            href: "/dashboard/admin/roles",
            permission: "roles:read",
          },
          {
            id: "auditLog",
            href: "/dashboard/admin/audit-log",
            permission: "audit:read",
          },
        ],
      },
      {
        id: "settings",
        icon: SettingsIcon,
        items: [
          {
            id: "schoolSettings",
            href: "/dashboard/settings",
            permission: "settings:read",
          },
          {
            id: "domains",
            href: "/dashboard/settings/domains",
            permission: "domains:read",
          },
          {
            // `POST /settings/export` is for school admins only.
            id: "dataExport",
            href: "/dashboard/settings/export",
            adminOnly: true,
          },
        ],
      },
    ],
  },
]

/** Pages of the shell that aren't in the sidebar, for breadcrumbs. */
export const EXTRA_PAGES: { id: NavLabel; href: string }[] = [
  { id: "account", href: "/dashboard/account" },
]
