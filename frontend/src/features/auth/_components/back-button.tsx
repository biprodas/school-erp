"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";

interface BackButtonProps {
  label: string;
  href: string;
}

export const BackButton = ({ href, label }: BackButtonProps) => {
  return (
    <Button variant="link" className="font-normal" size="sm" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
};
