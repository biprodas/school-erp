import { LINKS } from "~/config/site";
import { ButtonLink } from "../ui/button-link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

export const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#modules", label: "Modules" },
  { href: "#roles", label: "For your team" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <a href="#top" aria-label="Kampasy home" className="shrink-0">
          <Logo />
        </a>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-6 text-[15px] text-ink-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <a className="transition-colors hover:text-ink" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto hidden items-center gap-5 lg:flex">
          <a className="text-[15px] font-medium hover:text-forest-2" href={LINKS.login}>
            Find your school
          </a>
          <ButtonLink href={LINKS.signup} arrow>
            Get started free
          </ButtonLink>
        </div>

        <MobileMenu>
          <nav aria-label="Mobile">
            <ul className="divide-y divide-line">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a className="block py-3 text-base font-medium" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a className="block py-3 text-base font-medium" href={LINKS.login}>
                  Find your school
                </a>
              </li>
            </ul>
          </nav>
          <ButtonLink href={LINKS.signup} className="mt-4 w-full" arrow>
            Get started free
          </ButtonLink>
        </MobileMenu>
      </div>
    </header>
  );
}
