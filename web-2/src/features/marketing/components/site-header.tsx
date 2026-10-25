import { ArrowRightIcon, MenuIcon } from "lucide-react"
import Link from "next/link"

import { Button, buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet"
import { HeaderNav } from "./header-nav"
import { FIND_SCHOOL_HREF, NAV_LINKS, SIGNUP_HREF } from "../links"
import { Logo } from "./logo"
import { Container } from "./section"
import { ThemeSwitch } from "./theme-switch"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center gap-8">
        <Logo />
        <HeaderNav />
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <Link
            href={FIND_SCHOOL_HREF}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden sm:inline-flex"
            )}
          >
            Find your school
          </Link>
          <a
            href={SIGNUP_HREF}
            className={cn(
              buttonVariants({ size: "lg" }),
              "hidden rounded-full px-4 sm:inline-flex"
            )}
          >
            Get started free
            <ArrowRightIcon data-icon="inline-end" />
          </a>
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose
                    nativeButton={false}
                    key={link.href}
                    render={
                      <a
                        href={link.href}
                        className={cn(
                          buttonVariants({ variant: "ghost" }),
                          "justify-start"
                        )}
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <Link
                  href={FIND_SCHOOL_HREF}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "justify-start"
                  )}
                >
                  Find your school
                </Link>
                <SheetClose
                  nativeButton={false}
                  render={
                    <a
                      href={SIGNUP_HREF}
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "mt-2 rounded-full"
                      )}
                    />
                  }
                >
                  Get started free
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}
