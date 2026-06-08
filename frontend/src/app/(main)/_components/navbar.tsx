import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ThemeToggleButton } from "~/components/theme-toggle-button";
import { GraduationCap, ArrowRight, Menu } from "lucide-react";
import { ROUTES } from "~/constants";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Modules", href: "#modules" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">SchoolERP</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={ROUTES.PLATFORM_SIGNUP}>
              Get Started <ArrowRight />
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" className="md:hidden">
            <Menu />
          </Button>
        </div>
      </div>
    </header>
  );
}
