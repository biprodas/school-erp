import { CustomerLogos } from "./components/customer-logos";
import { DemoCta } from "./components/demo-cta";
import { Faq } from "./components/faq";
import { Hero } from "./components/hero";
import { ModulesGrid } from "./components/modules-grid";
import { Onboarding } from "./components/onboarding";
import { Perspectives } from "./components/perspectives";
import { Pricing } from "./components/pricing";
import { Security } from "./components/security";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { Testimonial } from "./components/testimonial";

export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <CustomerLogos />
        <Perspectives />
        <ModulesGrid />
        <Onboarding />
        <Security />
        <Pricing />
        <Testimonial />
        <Faq />
        <DemoCta />
      </main>
      <SiteFooter />
    </>
  );
}
