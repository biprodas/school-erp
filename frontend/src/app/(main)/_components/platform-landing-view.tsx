import { LandingPageBackground } from "./landing-page-background";
import { Navbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { FeaturesSection } from "./features-section";
import { ModulesSection } from "./modules-section";
import { HowItWorksSection } from "./how-it-works-section";
import { TestimonialsSection } from "./testimonials-section";
import { PricingSection } from "./pricing-section";
import { FaqSection } from "./faq-section";
import { CtaSection } from "./cta-section";
import { Footer } from "./footer";

export default function PlatformLandingView() {
  return (
    <div className="relative min-h-screen">
      <LandingPageBackground />
      <Navbar />
      <main className="relative">
        <HeroSection />
        <FeaturesSection />
        <ModulesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
