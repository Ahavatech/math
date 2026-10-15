"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  dryRunLecturerImportAction,
  bulkCreateLecturersAction,
  bulkSendInvitesAction,
  type DryRunResult,
} from "@/server/actions/lecturers";

type CreatedRow = { row: number; success: boolean; userId?: string; error?: string };

export function ImportWizard() {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [created, setCreated] = useState<CreatedRow[] | null>(null);
  const [inviteResults, setInviteResults] = useState<{ userId: string; success: boolean; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    setError(null);
    setDryRun(null);
    setCreated(null);
    setInviteResults(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      startTransition(async () => {
        try {
          const result = await dryRunLecturerImportAction(text);
          setDryRun(result);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not read this file");
        }
      });
    };
    reader.readAsText(file);
  }

  function createAccounts() {
    if (!dryRun) return;
    startTransition(async () => {
      const results = await bulkCreateLecturersAction(dryRun.validRows);
      setCreated(results.map((r) => ("userId" in r ? { row: r.row, success: true, userId: r.userId } : { row: r.row, success: false, error: r.error })));
    });
  }

  function sendInvites() {
    const userIds = (created ?? []).filter((r) => r.success && r.userId).map((r) => r.userId!);
    startTransition(async () => {
      const results = await bulkSendInvitesAction(userIds);
      setInviteResults(results);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-heading text-base font-semibold">Step 1: dry run</h2>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      </section>

      {dryRun ? (
        <section className="space-y-3">
          <p className="text-sm">
            <strong>{dryRun.validRows.length}</strong> valid row(s), <strong>{dryRun.errors.length}</strong> error(s).
          </p>
          {dryRun.validRows.length > 0 ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
              {dryRun.validRows.map((row) => (
                <li key={row.row}>
                  Row {row.row}: {row.fullName} ({row.honorific || "no honorific"}, {row.rank}, {row.email})
                </li>
              ))}
            </ul>
          ) : null}
          {dryRun.errors.length > 0 ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-destructive/40 p-2 text-sm text-destructive">
              {dryRun.errors.map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.reason}
                </li>
              ))}
            </ul>
          ) : null}

          {!created ? (
            <section className="space-y-2">
              <h2 className="font-heading text-base font-semibold">Step 2: create accounts</h2>
              <p className="text-sm text-muted-foreground">
                Creates the {dryRun.validRows.length} valid row(s) as DRAFT profiles. No email is sent yet.
              </p>
              <Button onClick={createAccounts} disabled={pending || dryRun.validRows.length === 0}>
                {pending ? "Creating..." : `Create ${dryRun.validRows.length} account(s)`}
              </Button>
            </section>
          ) : null}
        </section>
      ) : null}

      {created ? (
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold">Created</h2>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
            {created.map((r) => (
              <li key={r.row} className={r.success ? "" : "text-destructive"}>
                Row {r.row}: {r.success ? "created" : `failed (${r.error})`}
              </li>
            ))}
          </ul>

          {!inviteResults ? (
            <section className="space-y-2">
              <h2 className="font-heading text-base font-semibold">Step 3: send invites</h2>
              <p className="text-sm text-muted-foreground">
                Sends an invite email to each account just created, one at a time. This cannot be undone easily; resend
                individually from the lecturers list if one fails.
              </p>
              <Button onClick={sendInvites} disabled={pending}>
                {pending ? "Sending..." : "Send invites"}
              </Button>
            </section>
          ) : null}
        </section>
      ) : null}

      {inviteResults ? (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Invite results</h2>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
            {inviteResults.map((r) => (
              <li key={r.userId} className={r.success ? "" : "text-destructive"}>
                {r.userId}: {r.success ? "sent" : `failed (${r.error})`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
