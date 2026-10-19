import { Container, SectionTitle } from "./primitives";
import { WalkthroughForm } from "./walkthrough-form";

export function DemoCta() {
  return (
    <section id="contact" className="bg-cream scroll-mt-16 pb-20 sm:pb-28">
      <Container className="max-w-6xl">
        <div className="bg-brand rounded-3xl px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <SectionTitle className="mx-auto max-w-2xl">
            Give your school the system it deserves.
          </SectionTitle>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-white/80">
            See Kampasy with your own workflows in a free, no-pressure 30-minute
            demo.
          </p>
          <div className="mx-auto mt-10 max-w-md">
            <WalkthroughForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
