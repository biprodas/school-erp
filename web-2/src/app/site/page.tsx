import { Faq } from "~/features/marketing/components/faq"
import { GetStarted } from "~/features/marketing/components/get-started"
import { Hero } from "~/features/marketing/components/hero"
import { MadeForYourSchool } from "~/features/marketing/components/made-for-your-school"
import { Modules } from "~/features/marketing/components/modules"
import { Pricing } from "~/features/marketing/components/pricing"
import { Results } from "~/features/marketing/components/results"
import { Roles } from "~/features/marketing/components/roles"
import { SchoolDay } from "~/features/marketing/components/school-day"
import { Setup } from "~/features/marketing/components/setup"
import { SiteFooter } from "~/features/marketing/components/site-footer"
import { SiteHeader } from "~/features/marketing/components/site-header"
import { WhySwitch } from "~/features/marketing/components/why-switch"

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
        <MadeForYourSchool />
        <Setup />
        <Pricing />
        <Faq />
        <GetStarted />
      </main>
      <SiteFooter />
    </>
  )
}
