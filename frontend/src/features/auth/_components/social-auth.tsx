"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { Button } from "~/components/ui/button";
import { DEFAULT_LOGIN_REDIRECT } from "~/constants/routes";
import { cn } from "~/lib/utils";

interface SocialAuthProps {
  mode?: "row" | "col";
  providers?: ("google" | "github" | "linkedin")[];
}

export const SocialAuth = ({ mode = "row", providers = ["google"] }: SocialAuthProps) => {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const onClick = (provider: "google" | "github" | "linkedin") => {
    signIn(provider, {
      callbackUrl: callbackUrl || DEFAULT_LOGIN_REDIRECT,
    });
  };

  return (
    <div className={cn("flex items-center w-full gap-3", mode === "col" && "flex-col")}>
      {
        providers.map((provider) => {
          return (
            <Button
              key={provider}
              className="w-full"
              variant="outline"
              onClick={() => onClick(provider)}
            >
              {provider === "google" && <FcGoogle className="size-5 me-3" />}
              {provider === "github" && <FaGithub className="size-5 me-3" />}
              {provider === "linkedin" && <FaLinkedin className="size-5 me-3" />}
              {provider}
            </Button>
          )
        })
      }
    </div>
  );
};
