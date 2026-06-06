import { CheckIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export type OnboardingStep = "signup" | "school" | "setup" | "complete";

const STEPS: { key: OnboardingStep; label: string }[] = [
  { key: "signup", label: "Create account" },
  { key: "school", label: "Create school" },
  { key: "setup", label: "Set up access" },
  { key: "complete", label: "Finish" },
];

/** Presentational step indicator for the onboarding wizard. */
export function OnboardingStepper({ current }: { current: OnboardingStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex w-full items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isDone &&
                    !isCurrent &&
                    "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {isDone ? <CheckIcon className="size-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  "h-px w-6 sm:w-10",
                  index < currentIndex ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
