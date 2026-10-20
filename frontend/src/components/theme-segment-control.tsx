"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useMounted } from "~/hooks/use-mounted";
import { cn } from "~/lib/utils";

const OPTIONS = [
  { value: "light" as const, label: "Light theme", icon: Sun },
  { value: "dark" as const, label: "Dark theme", icon: Moon },
  { value: "system" as const, label: "System theme", icon: Monitor },
];

export function ThemeSegmentControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div
        className={cn("h-9 w-full rounded-full bg-muted animate-pulse", className)}
        aria-hidden
      />
    );
  }

  const active = theme ?? "system";

  return (
    <div
      className={cn("flex w-fit rounded-md bg-muted p-0.5 gap-0.5 border border-border/30", className)}
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isOn = active === value;
        return (
          <Button 
            variant="ghost"
            size="icon-sm"
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-label={label}
            aria-pressed={isOn}
            className={cn(
              "flex flex-1 items-center justify-center py-2 text-sm outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isOn
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
          </Button>
        );
      })}
    </div>
  );
}
