import { Faq } from "~/components/landing/faq";
import { Hero } from "~/components/landing/hero";
import { KeyFigures } from "~/components/landing/key-figures";
import { Localization } from "~/components/landing/localization";
import { Modules } from "~/components/landing/modules";
import { Pricing } from "~/components/landing/pricing";
import { Results } from "~/components/landing/results";
import { RolesSection } from "~/components/landing/roles-section";
import { SchoolDay } from "~/components/landing/school-day";
import { Setup } from "~/components/landing/setup";
import { FinalCta, SiteFooter } from "~/components/landing/site-footer";
import { SiteHeader } from "~/components/landing/site-header";
import { WhySwitch } from "~/components/landing/why-switch";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:font-semibold focus:ring-2 focus:ring-forest-2"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <KeyFigures />
        <WhySwitch />
        <SchoolDay />
        <RolesSection />
        <Modules />
        <Results />
        <Localization />
        <Setup />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
