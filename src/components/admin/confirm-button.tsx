"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * A button that asks first. The dialog says what will happen, to what, and
 * whether it can be undone, so nobody has to guess from a bare "Delete".
 * `subject` names the thing (the post title, the person) and is used in the
 * accessible name of the trigger, so a screen reader hears "Delete: Open day"
 * and not the same word on every row.
 */
export function ConfirmButton({
  label,
  subject,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  size = "sm",
  disabled,
  disabledTitle,
  children,
}: {
  label: string;
  subject?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "destructive" | "outline";
  size?: "sm" | "default" | "icon-sm";
  disabled?: boolean;
  disabledTitle?: string;
  /** Replaces the text label, for an icon-only trigger. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={variant}
            size={size}
            disabled={disabled}
            aria-label={subject ? `${label}: ${subject}` : label}
            title={disabled ? disabledTitle : undefined}
          />
        }
      >
        {children ?? label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await onConfirm();
                setOpen(false);
              })
            }
          >
            {pending ? "Working..." : (confirmLabel ?? label)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
