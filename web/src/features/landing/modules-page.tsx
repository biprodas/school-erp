import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { APP_LINKS } from "~/config/site";
import { ModuleCards } from "./components/modules-grid";
import { Container, SectionTitle, pill } from "./components/primitives";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { MODULES } from "./content";

export function ModulesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-ink flex-1 text-white">
        <Container className="py-16 sm:py-24">
          <Link
            href="/#modules"
            className="inline-flex items-center gap-1.5 text-sm text-white/65 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back to home
          </Link>
          <p className="text-highlight mt-8 text-xs font-bold tracking-[0.14em] uppercase">
            All modules
          </p>
          <SectionTitle className="mt-3 max-w-3xl">
            Every department, one connected platform.
          </SectionTitle>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
            The essentials are ready today. The rest arrive on the same records,
            so nothing has to be re-entered when you switch them on.
          </p>

          <ModuleCards modules={MODULES} className="mt-14" />

          <div className="mt-14 flex flex-col items-center gap-4 text-center">
            <p className="text-white/65">
              Try every available module free for 30 days.
            </p>
            <a href={APP_LINKS.signup} className={pill.highlight}>
              Start free trial <ArrowRight className="size-4" />
            </a>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
