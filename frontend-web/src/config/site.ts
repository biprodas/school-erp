/**
 * Brand and outbound links. The marketing site only links into the product
 * app: signup and sign-in live on the app host, each school on its own
 * subdomain of ROOT_DOMAIN.
 */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@kampasy.com";

export const SITE = {
  name: "Kampasy",
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN || "kampasy.com",
  email: CONTACT_EMAIL,
  location: process.env.NEXT_PUBLIC_COMPANY_LOCATION || "Dhaka, Bangladesh",
} as const;

export const LINKS = {
  signup: `${APP_URL}/signup`,
  login: `${APP_URL}/login`,
  demo: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Demo request")}`,
  quote: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Pricing for our school")}`,
  privacy: "/privacy",
  terms: "/terms",
} as const;
