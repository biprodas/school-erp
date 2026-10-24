import { Faq } from "./_landing/faq"
import { GetStarted } from "./_landing/get-started"
import { Hero } from "./_landing/hero"
import { MadeForBangladesh } from "./_landing/made-for-bangladesh"
import { Modules } from "./_landing/modules"
import { Pricing } from "./_landing/pricing"
import { Results } from "./_landing/results"
import { Roles } from "./_landing/roles"
import { SchoolDay } from "./_landing/school-day"
import { Setup } from "./_landing/setup"
import { SiteFooter } from "./_landing/site-footer"
import { SiteHeader } from "./_landing/site-header"
import { WhySwitch } from "./_landing/why-switch"

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <WhySwitch />
        <SchoolDay />
        <Roles />
        <Modules />
        <Results />
        <MadeForBangladesh />
        <Setup />
        <Pricing />
        <Faq />
        <GetStarted />
      </main>
      <SiteFooter />
    </>
  )
}
