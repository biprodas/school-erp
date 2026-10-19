import { DemoCta } from "./components/demo-cta";
import { Faq } from "./components/faq";
import { Hero } from "./components/hero";
import { HowItWorks } from "./components/how-it-works";
import { SchoolDay } from "./components/school-day";
import { KeyMetrics } from "./components/key-metrics";
import { ModulesGrid } from "./components/modules-grid";
import { Onboarding } from "./components/onboarding";
import { Perspectives } from "./components/perspectives";
import { Pricing } from "./components/pricing";
import { Security } from "./components/security";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { Why } from "./components/why";

export function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="bg-ink sr-only rounded-full px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-[60]"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <KeyMetrics />
        <Why />
        <Perspectives />
        <HowItWorks />
        <SchoolDay />
        <ModulesGrid />
        <Onboarding />
        <Security />
        <Pricing />
        <Faq />
        <DemoCta />
      </main>
      <SiteFooter />
    </>
  );
}
