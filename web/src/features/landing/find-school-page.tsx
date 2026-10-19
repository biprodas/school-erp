import { APP_LINKS } from "~/config/site";
import { FindSchoolForm } from "./components/find-school-form";
import { Container } from "./components/primitives";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";

export function FindSchoolPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-cream flex-1">
        <Container className="flex justify-center py-20 sm:py-28">
          <div className="border-border w-full max-w-md rounded-3xl border bg-white px-6 py-10 sm:px-10">
            <h1 className="text-ink text-3xl font-bold tracking-tight">
              Sign in to your school
            </h1>
            <p className="text-ink-muted mt-2 leading-relaxed">
              Each school has its own address. Enter yours to continue.
            </p>
            <div className="mt-8">
              <FindSchoolForm />
            </div>
            <p className="text-ink-muted border-border mt-8 border-t pt-5 text-sm">
              Running the platform?{" "}
              <a
                href={APP_LINKS.login}
                className="text-ink font-semibold underline-offset-4 hover:underline"
              >
                Platform sign-in
              </a>
            </p>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
