"use client";

import { Menu, X } from "lucide-react";
import { useRef, type MouseEvent, type ReactNode } from "react";

/** A <details> disclosure (works without JS) that closes once a link is followed. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  function closeOnLink(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("a") && ref.current) ref.current.open = false;
  }

  return (
    <details ref={ref} className="group ml-auto lg:hidden">
      <summary
        aria-label="Menu"
        className="flex size-10 cursor-pointer items-center justify-center rounded-full ring-1 ring-line-strong ring-inset"
      >
        <Menu className="size-5 group-open:hidden" aria-hidden="true" />
        <X className="hidden size-5 group-open:block" aria-hidden="true" />
      </summary>
      <div
        onClick={closeOnLink}
        className="absolute inset-x-0 top-16 border-b border-line bg-canvas px-4 pt-2 pb-5 shadow-[0_16px_24px_-16px_rgba(18,39,30,0.25)]"
      >
        {children}
      </div>
    </details>
  );
}
