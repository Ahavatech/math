"use client";

import { useActionState, useState, useTransition } from "react";
import type { AlumniEntry, AlumniProgramme } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";
import { INDUSTRIES } from "@/lib/industries";
import {
  updateAlumniEntryAction,
  approveAlumniEntryAction,
  rejectAlumniEntryAction,
  withdrawAlumniEntryAction,
  restoreAlumniEntryAction,
  eraseAlumniEntryAction,
  markDuplicateAction,
} from "@/server/actions/alumni-review";

type EntryWithPhoto = AlumniEntry & {
  photoUrl: string | null;
  programmes: AlumniProgramme[];
};

function levelLabel(level: string) {
  if (level === "BSC") return "B.Sc.";
  if (level === "MSC") return "M.Sc.";
  return "Ph.D.";
}

export function ReviewForm({
  entry,
  duplicates,
  canErase,
}: {
  entry: EntryWithPhoto;
  duplicates: (AlumniEntry & { programmes: AlumniProgramme[] })[];
  canErase: boolean;
}) {
  const [updateState, updateAction, updatePending] = useActionState(updateAlumniEntryAction, undefined);
  const [pending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [duplicateAction, setDuplicateAction] = useState<"separate" | "replace" | "reject">("separate");
  const [selectedDuplicateId, setSelectedDuplicateId] = useState(duplicates[0]?.id ?? "");

  function run(action: (fd: FormData) => Promise<unknown>, extra?: Record<string, string>) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", entry.id);
      if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      await action(fd);
      window.location.reload();
    });
  }

  const busy = pending || updatePending;

  return (
    <div className="space-y-8">
      {entry.photoUrl ? (
        <div className="space-y-1">
          <Label>Photo</Label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={entry.photoUrl} alt={`Photo of ${entry.fullName}`} className="h-40 w-40 rounded-md border border-border object-cover" />
        </div>
      ) : null}

      {entry.programmes.length > 0 ? (
        <div className="space-y-1">
          <Label>Programmes</Label>
          <ul className="space-y-1 text-sm">
            {entry.programmes.map((p) => (
              <li key={p.id} className="text-muted-foreground">
                {levelLabel(p.level)} &mdash; {p.entryYear ? `${p.entryYear} to ` : ""}{p.graduationYear}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={updateAction} className="space-y-4">
        <input type="hidden" name="id" value={entry.id} />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" defaultValue={entry.fullName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email (private)</Label>
            <Input id="email" name="email" type="email" defaultValue={entry.email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organisation">Organisation</Label>
            <Input id="organisation" name="organisation" defaultValue={entry.organisation ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roleOrField">Role or field</Label>
            <Input id="roleOrField" name="roleOrField" defaultValue={entry.roleOrField ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={entry.city ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <select id="country" name="country" defaultValue={entry.country ?? ""} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Not set</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="note">Note (one line, optional)</Label>
            <Input id="note" name="note" maxLength={200} defaultValue={entry.note ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <select id="industry" name="industry" defaultValue={entry.industry ?? ""} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Not set</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input id="linkedinUrl" name="linkedinUrl" defaultValue={entry.linkedinUrl ?? ""} />
          </div>
        </div>
        {updateState?.error ? <p className="text-sm text-destructive" role="alert">{updateState.error}</p> : null}
        <Button type="submit" disabled={updatePending} variant="outline">
          {updatePending ? "Saving..." : "Save edits"}
        </Button>
      </form>

      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-sm font-medium">Status: {entry.status}</p>
        {entry.isDuplicateEmail ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 border border-amber-200">
            Duplicate email detected -- another entry with this email address has been submitted.
          </p>
        ) : null}

        {entry.status === "PENDING" && duplicates.length > 0 ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Possible duplicate of:</p>
            <select
              value={selectedDuplicateId}
              onChange={(e) => setSelectedDuplicateId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {duplicates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName} ({d.programmes[0]?.graduationYear ?? "?"}, {d.status})
                </option>
              ))}
            </select>
            <select
              value={duplicateAction}
              onChange={(e) => setDuplicateAction(e.target.value as typeof duplicateAction)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="separate">Approve as separate</option>
              <option value="replace">Replace existing entry (existing becomes withdrawn)</option>
              <option value="reject">Reject this one as a duplicate</option>
            </select>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => run(markDuplicateAction, { existingId: selectedDuplicateId, action: duplicateAction })}
            >
              Apply
            </Button>
          </div>
        ) : null}

        {entry.status === "PENDING" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => run(approveAlumniEntryAction)}>
              Approve
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => run(approveAlumniEntryAction, { feature: "true" })}>
              Approve and feature
            </Button>
          </div>
        ) : null}

        {entry.status === "PENDING" ? (
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Reason for rejection (stored, never public)</Label>
            <textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
            />
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !rejectReason.trim()}
              onClick={() => run(rejectAlumniEntryAction, { reason: rejectReason })}
            >
              Reject
            </Button>
          </div>
        ) : null}

        {entry.status === "APPROVED" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => run(withdrawAlumniEntryAction)}>
              Withdraw
            </Button>
          </div>
        ) : null}

        {entry.status === "WITHDRAWN" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => run(restoreAlumniEntryAction)}>
              Restore
            </Button>
          </div>
        ) : null}

        {canErase ? (
          <div className="border-t border-border pt-3">
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Permanently erase this entry and its photo? This cannot be undone.")) {
                  run(eraseAlumniEntryAction);
                }
              }}
            >
              Erase permanently
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
