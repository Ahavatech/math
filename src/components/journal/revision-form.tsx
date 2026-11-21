"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitRevisionAction, type RevisionActionState } from "@/server/actions/manuscript-submission";

export function RevisionForm({
  manuscriptId,
  defaultResponse,
  hasRevisedFile,
}: {
  manuscriptId: string;
  defaultResponse: string;
  hasRevisedFile: boolean;
}) {
  const [state, action, pending] = useActionState<RevisionActionState, FormData>(submitRevisionAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="manuscriptId" value={manuscriptId} />
      <div className="space-y-1">
        <Label htmlFor="response">Response to the reviewers</Label>
        <p id="response-hint" className="text-muted-foreground text-sm">
          Go through each comment and say what you changed, or why you did not. This is read by the editor
          and the reviewers.
        </p>
        <Textarea
          id="response"
          name="response"
          rows={10}
          required
          minLength={20}
          maxLength={20000}
          defaultValue={defaultResponse}
          aria-describedby="response-hint"
        />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {!hasRevisedFile ? (
        <p className="text-muted-foreground text-sm">Upload your revised manuscript above before sending.</p>
      ) : null}
      <Button type="submit" disabled={pending || !hasRevisedFile}>
        {pending ? "Sending..." : "Send revision"}
      </Button>
    </form>
  );
}
