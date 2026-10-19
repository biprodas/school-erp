import { Container, Logo } from "./primitives";

export function SiteFooter() {
  return (
    <footer className="border-border bg-cream border-t">
      <Container className="flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
        <Logo />
        <p className="text-ink-muted text-sm">
          © <CopyrightYear /> Kampasy Technologies. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}

// Cache Components forbids `new Date()` during prerender; caching it fixes the
// year at build/revalidation time, which is precise enough for a copyright line.
async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}
