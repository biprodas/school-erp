"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { OwnerActivation } from "~/apis/platform/organizations/types";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { buildTenantActivationUrl } from "~/lib/tenant";

interface ActivationLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activation: OwnerActivation | null;
}

/**
 * Shows the one-time owner activation link for the admin to copy and share.
 * The owner opens it on the tenant subdomain to set their password.
 */
export function ActivationLinkDialog({
  open,
  onOpenChange,
  activation,
}: ActivationLinkDialogProps) {
  const [copied, setCopied] = useState(false);

  const url = activation
    ? buildTenantActivationUrl(activation.orgSlug, activation.token)
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Activation link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the link manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Owner activation link</DialogTitle>
          <DialogDescription>
            Share this one-time link with the owner so they can set their
            password and sign in. It expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={copy}>
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
            <span className="sr-only">Copy link</span>
          </Button>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
