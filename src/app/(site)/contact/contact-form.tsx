"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitContactMessageAction } from "@/server/actions/contact";

const TYPE_LABELS: Record<string, string> = {
  ADMISSIONS: "Admissions",
  RESEARCH: "Research",
  COLLABORATION: "Collaboration",
  ALUMNI: "Alumni",
  GENERAL: "General",
};

export function ContactForm({
  defaultType,
  reference,
  formToken,
  formRenderedAt,
}: {
  defaultType: "ADMISSIONS" | "RESEARCH" | "COLLABORATION" | "ALUMNI" | "GENERAL";
  reference?: string;
  formToken: string;
  formRenderedAt: number;
}) {
  const [state, action, pending] = useActionState(submitContactMessageAction, undefined);

  if (state?.success) {
    return <p className="text-sm">Thank you. Your message has been received.</p>;
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="formToken" value={formToken} />
      <input type="hidden" name="formRenderedAt" value={formRenderedAt} />

      {/* Honeypot: hidden from sighted users, out of the tab order. A genuine visitor never sees or fills this. */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required maxLength={254} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">Type</Label>
        <select id="type" name="type" defaultValue={defaultType} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          name="subject"
          required
          maxLength={200}
          defaultValue={reference ? `Alumni entry ${reference}` : ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={4000}
          className="min-h-32 w-full rounded-md border border-input bg-background p-2 text-sm"
          defaultValue={reference ? `Reference: ${reference}\n\n` : ""}
        />
      </div>
      {state?.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send message"}
      </Button>
    </form>
  );
}
