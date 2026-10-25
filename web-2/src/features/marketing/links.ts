import { siteConfig } from "~/config/site-config"

// Targets for the landing page's calls to action.
export const SIGNUP_HREF = "/signup"
export const FIND_SCHOOL_HREF = "/find-school"
export const CONTACT_EMAIL = siteConfig.contactEmail
export const DEMO_HREF = `mailto:${CONTACT_EMAIL}?subject=Book%20a%20demo`

export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Modules", href: "#modules" },
  { label: "For your team", href: "#roles" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
]
