const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "lvh.me";

export const siteConfig = {
  name: "SchoolERP",
  title: "SchoolERP — Modern School Management Platform",
  description: "SchoolERP unifies admissions, academics, finance, HR, and communication on a single platform — helping schools run smarter, from a single classroom to a multi-campus institution.",
  keywords: [
    "school ERP",
    "school management system",
    "student information system",
    "academic management",
    "school administration software",
    "fee management",
    "attendance management",
    "school finance software",
  ],
  siteUrl,
  robots: "index, follow",
};

export type SiteConfig = typeof siteConfig;
